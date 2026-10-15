// Henter ekte konkursstatistikk fra SSB sitt åpne API for næringene i porteføljen.
// Kjør: npm run ssb  → data/ssb-konkurs.json
//
// Tabell 10790: Åpnede foretakskonkurser etter region, næring (SN2007, 5-siffer) og kvartal.
// Tabell 07091: Bedrifter etter region og næring (SN2007, 2-siffer), brukes som nevner.

import { readFileSync, writeFileSync } from "node:fs";

const API = "https://data.ssb.no/api/v0/no/table";
const REGIONER = { "0": "Hele landet", "46": "Vestland" } as const;

interface Kundedata {
  Bedrifter: { nace: string; bransje: string }[];
}

async function hentMeta(tabell: string) {
  const res = await fetch(`${API}/${tabell}`);
  if (!res.ok) throw new Error(`SSB ${tabell}: ${res.status}`);
  return (await res.json()) as { variables: { code: string; values: string[]; valueTexts: string[] }[] };
}

async function sporring(tabell: string, utvalg: Record<string, string[]>) {
  const body = {
    query: Object.entries(utvalg).map(([code, values]) => ({ code, selection: { filter: "item", values } })),
    response: { format: "json-stat2" },
  };
  const res = await fetch(`${API}/${tabell}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`SSB ${tabell}: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    value: (number | null)[];
    id: string[];
    size: number[];
    dimension: Record<string, { category: { index: Record<string, number>; label: Record<string, string> } }>;
    updated: string;
  };
}

// Slår opp verdien for en kombinasjon av dimensjonsverdier i et json-stat2-svar
function verdi(svar: Awaited<ReturnType<typeof sporring>>, valg: Record<string, string>): number {
  let indeks = 0;
  for (let i = 0; i < svar.id.length; i++) {
    const dim = svar.id[i];
    const pos = svar.dimension[dim].category.index[valg[dim]];
    if (pos === undefined) return 0;
    indeks = indeks * svar.size[i] + pos;
  }
  return svar.value[indeks] ?? 0;
}

const kundedata: Kundedata = JSON.parse(readFileSync(new URL("../data/kundedata.json", import.meta.url), "utf8"));
const porteføljeKoder = [...new Set(kundedata.Bedrifter.map((b) => b.nace))].sort();
const toSiffer = [...new Set(porteføljeKoder.map((k) => k.slice(0, 2)))].sort();

// 10790: alle 5-sifrede koder under næringene vi har, siste 8 kvartaler
const meta = await hentMeta("10790");
const nace = meta.variables.find((v) => v.code === "NACE2007")!;
const tid = meta.variables.find((v) => v.code === "Tid")!.values;
const kvartaler = tid.slice(-8);
const koder = nace.values.filter((k) => toSiffer.includes(k.slice(0, 2)));
const konkurs = await sporring("10790", { Region: Object.keys(REGIONER), NACE2007: koder, ContentsCode: ["Foretakskonkurser"], Tid: kvartaler });

// 07091: antall bedrifter per 2-sifret næring, siste år
const meta2 = await hentMeta("07091");
const sisteAar = meta2.variables.find((v) => v.code === "Tid")!.values.at(-1)!;
const bedrifter = await sporring("07091", { Region: Object.keys(REGIONER), NACE2007: toSiffer, AntAnsatte: ["99"], ContentsCode: ["Bedrifter"], Tid: [sisteAar] });

const siste4 = kvartaler.slice(-4);
const forrige4 = kvartaler.slice(0, 4);
const sum = (region: string, prefiks: (k: string) => boolean, perioder: string[]) =>
  koder.filter(prefiks).reduce((s, k) => s + perioder.reduce((t, q) => t + verdi(konkurs, { Region: region, NACE2007: k, ContentsCode: "Foretakskonkurser", Tid: q }), 0), 0);

const naeringar: Record<string, unknown> = {};
for (const ts of toSiffer) {
  const iGruppe = (k: string) => k.startsWith(ts);
  const rad: Record<string, unknown> = { namn: meta2.variables.find((v) => v.code === "NACE2007")!.valueTexts[meta2.variables.find((v) => v.code === "NACE2007")!.values.indexOf(ts)] };
  for (const [region, regionNavn] of Object.entries(REGIONER)) {
    const n = sum(region, iGruppe, siste4);
    const f = sum(region, iGruppe, forrige4);
    const b = verdi(bedrifter, { Region: region, NACE2007: ts, AntAnsatte: "99", ContentsCode: "Bedrifter", Tid: sisteAar });
    rad[regionNavn] = {
      konkursar_siste_4_kvartal: n,
      konkursar_forrige_4_kvartal: f,
      endring_pst: f > 0 ? Math.round(((n - f) / f) * 100) : null,
      bedrifter: b,
      konkursar_per_1000_bedrifter: b > 0 ? Math.round((n / b) * 10000) / 10 : null,
    };
  }
  naeringar[ts] = rad;
}

// 5-siffer for koder i porteføljen (SSB deler noen koder i underkoder, disse summeres)
const femSiffer: Record<string, unknown> = {};
for (const k of porteføljeKoder) {
  const prefiks = k.endsWith("0") ? k.slice(0, 5) : k;
  const iKode = (x: string) => x === k || x.startsWith(prefiks);
  femSiffer[k] = {
    Vestland: { siste_4_kvartal: sum("46", iKode, siste4), forrige_4_kvartal: sum("46", iKode, forrige4) },
    "Hele landet": { siste_4_kvartal: sum("0", iKode, siste4), forrige_4_kvartal: sum("0", iKode, forrige4) },
    ssb_koder: koder.filter(iKode),
  };
}

const ut = {
  kjelde: "SSB, tabell 10790 (åpnede foretakskonkurser) og 07091 (bedrifter etter næring)",
  henta: new Date().toISOString().slice(0, 10),
  oppdatert_ssb: konkurs.updated,
  kvartal_siste_4: siste4,
  kvartal_forrige_4: forrige4,
  bedrifter_aar: sisteAar,
  merknad: "Foretakskonkurser (ekskl. enkeltpersonforetak). Rate per 1000 bedrifter er en tilnærming: bedrifter (virksomheter) brukes som nevner fordi foretak per næring ikke finnes i samme tabell.",
  naeringar_2siffer: naeringar,
  naeringar_5siffer: femSiffer,
};
writeFileSync(new URL("../data/ssb-konkurs.json", import.meta.url), JSON.stringify(ut, null, 2) + "\n");
console.log(`Skrev data/ssb-konkurs.json: ${toSiffer.length} næringer (2-siffer), ${porteføljeKoder.length} koder (5-siffer)`);
