// KI-generert møterapport (ca. én side) før kundemøtet.
//
// Flyt uten API-nøkkel: appen lager en prompt med kildekatalog og JSON-skjema →
// rådgiveren kjører den i Claude Desktop (med websøk) → limer inn svaret → appen
// validerer med Zod og kontrollerer hver kildehenvisning før rapporten vises.
//
// Grounding:
//  1. Skjema: svaret må passe RapportSchema (Zod), ellers vises feilene.
//  2. Kilder: hvert punkt må vise til minst én kilde-ID fra katalogen eller en nettkilde (W1, W2 …).
//  3. Sitater: sitatet må stå ordrett i kilden (katalog sjekkes lokalt, nettkilder hentes på serveren).
//  4. Tall: tall i teksten må finnes i de siterte kildene, ellers flagges de.

import { z } from "zod";
import type { Kunde } from "./types";
import type { Smitte, Vurdering } from "./score";
import { DAGENS_DATO, kortDato, langDato } from "./dato";
import { kr, mnok, omUker, prosent } from "./format";
import { vurderTiltak } from "./tiltak";

// ---------- skjema ----------
const Kildehenvisning = z.object({
  id: z.string().describe("ID fra KILDEKATALOG (f.eks. K-PROGNOSE, H-0042) eller nettkilde (W1, W2 …)"),
  sitat: z.string().min(3).max(300).describe("Ordrett utdrag fra kilden, kopiert tegn for tegn (maks ca. 25 ord)"),
});

const Punkt = z.object({
  tekst: z.string().min(10).max(320).describe("Én kort, konkret setning. Tall skrives nøyaktig som i kilden."),
  kilder: z.array(Kildehenvisning).min(1).max(3),
});

const Webkilde = z.object({
  id: z.string().regex(/^W\d+$/).describe("W1, W2 …"),
  url: z.string().url().startsWith("https://"),
  tittel: z.string().min(3),
  utgiver: z.string().min(2),
  publisert: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD"),
  sitat: z.string().min(10).max(400).describe("Ordrett utdrag fra artikkelen"),
});

export const RapportSchema = z.object({
  kundeId: z.string().describe("Kundens ID, f.eks. B-114"),
  sammendrag: z.string().min(40).max(600).describe("2–3 setninger: det rådgiveren må vite før møtet"),
  situasjon: z.array(Punkt).min(2).max(5).describe("Kundens situasjon nå: likviditet, regnskap, engasjement"),
  risikoer: z
    .array(Punkt.extend({ alvor: z.enum(["høy", "middels", "lav"]) }))
    .min(1)
    .max(5)
    .describe("Viktigste risikoer, mest alvorlig først"),
  muligheter: z.array(Punkt).max(3).describe("Muligheter for kunden eller banken, bare hvis kildene støtter det"),
  bransjeOgMarked: z.array(Punkt).min(1).max(3).describe("Bransje, region og makro: SSB-katalogen og nettkilder"),
  sporsmal: z.array(z.string().min(10).max(220)).min(3).max(6).describe("Åpne spørsmål rådgiveren bør stille"),
  anbefaltTiltak: z
    .array(Punkt.extend({ tiltak: z.string().min(3).max(80) }))
    .max(3)
    .describe("Tiltak fra katalogen (T-…), mest egnet først"),
  varsomhet: z.string().max(400).nullable().describe("Sensitiv situasjon eller taushetsplikt å være obs på, ellers null"),
  ikkeKjent: z.array(z.string().max(220)).max(5).describe("Det kildene ikke kan svare på"),
  webkilder: z.array(Webkilde).max(5).describe("Nettkilder brukt i rapporten"),
});

export type Rapport = z.infer<typeof RapportSchema>;
export const rapportJsonSkjema = () => z.toJSONSchema(RapportSchema);

// ---------- kildekatalog ----------
export interface Katalogkilde {
  id: string;
  type: "Bankdata" | "Prognose" | "Score" | "Tiltak" | "Regnskap" | "Hendelse" | "Notat" | "SSB";
  tittel: string;
  dato?: string;
  tekst: string;
}

export function byggKildekatalog(kunde: Kunde, v: Vurdering, smitte: Smitte[]): Katalogkilde[] {
  const p = v.prognose;
  const k: Katalogkilde[] = [];
  const trekk = kunde.kassekredittTrekk.at(-1) ?? 0;

  k.push({
    id: "K-KUNDE",
    type: "Bankdata",
    tittel: "Kundebilde",
    tekst: `${kunde.navn}, ${kunde.naceKode}, ${kunde.adresse}. ${kunde.ansatte} ansatte, etablert ${kunde.etablert}, kunde siden ${kunde.kundeSiden}. ${kunde.segment} bedrift, ${kunde.eierstruktur.toLowerCase()}. Risikoklasse ${kunde.risikoklasse}. Daglig leder: ${kunde.dagligLeder}.`,
  });
  k.push({
    id: "K-REGNSKAP",
    type: "Regnskap",
    tittel: "Årsregnskap",
    tekst: `Omsetning ${kunde.regnskapIFjor.omsetning.map((o) => `${o.aar}: ${mnok(o.belop)}`).join(", ")}. Driftsresultat 2025: ${mnok(kunde.regnskapIFjor.driftsresultat)}. Egenkapitalandel: ${prosent(kunde.regnskapIFjor.egenkapitalAndel)}.`,
  });
  k.push({
    id: "K-ENGASJEMENT",
    type: "Bankdata",
    tittel: "Engasjement",
    tekst: `${kunde.kassekredittRamme > 0 ? `Kassekreditt med ramme ${mnok(kunde.kassekredittRamme)}, trekk i dag ${mnok(trekk)} (${prosent(v.kkUtnyttelse)} utnyttet).` : "Ingen kassekreditt."} ${
      kunde.lan.length ? `Lån: ${kunde.lan.map((l) => `${l.navn} ${mnok(l.saldo)}`).join(", ")}.` : "Ingen lån."
    } Sikkerheter: ${mnok(kunde.sikkerheter)}.`,
  });
  k.push({
    id: "K-PROGNOSE",
    type: "Prognose",
    tittel: `13-ukers likviditetsprognose per ${langDato(DAGENS_DATO)}`,
    tekst: `Insolvensgrense: ${mnok(-p.ramme)}. ${
      p.tomKasseDato ? `Grensen passeres ${kortDato(p.tomKasseDato)} (${omUker(p.ukerTilTomKasse!)}).` : "Grensen passeres ikke i forventet forløp."
    } Sannsynlighet for å havne under grensen: ${prosent(p.sannsynlighetInsolvens)}. Laveste saldo: ${mnok(p.lavesteSaldo)} den ${kortDato(p.lavesteDato)}. ${
      p.margin < 0 ? `Mangler ${kr(-p.margin)} på det verste.` : `Margin på det laveste: ${kr(p.margin)}.`
    }`,
  });
  k.push({ id: "K-SCORE", type: "Score", tittel: "Risikoscore", tekst: `Risikoscore ${v.score} av 100 (${v.niva}).` });
  for (const f of v.faktorer.filter((x) => x.poeng > 0)) {
    k.push({ id: `F-${f.id.toUpperCase()}`, type: "Score", tittel: f.navn, tekst: f.forklaring });
  }
  if (kunde.debitorer.length) {
    k.push({
      id: "K-BETALERE",
      type: "Bankdata",
      tittel: "Største betalere 2026",
      tekst: kunde.debitorer
        .slice(0, 5)
        .map((d) => `${d.navn}: ${prosent(d.andelAvInnbetalinger)} av innbetalingene`)
        .join("; "),
    });
  }
  k.push({ id: "K-BRANSJE", type: "SSB", tittel: "Bransjerisiko (SSB)", tekst: kunde.bransjerisiko.forklaring });

  const tv = vurderTiltak(kunde);
  for (const e of [...tv.effekter].sort((a, b) => b.forbedring - a.forbedring).slice(0, 5)) {
    k.push({
      id: `T-${e.tiltak.id.toUpperCase()}`,
      type: "Tiltak",
      tittel: e.tiltak.navn,
      tekst: `${e.tiltak.navn}: ${e.tiltak.beskrivelse} Effekt på laveste punkt: ${kr(e.forbedring)}. Sannsynlighet etter tiltak: ${prosent(e.prognose.sannsynlighetInsolvens)}.${
        e.tiltak.betalingslettelse ? " Er en betalingslettelse." : ""
      } Forbehold: ${e.tiltak.forbehold}`,
    });
  }
  if (tv.pakke) {
    k.push({
      id: "T-PAKKE",
      type: "Tiltak",
      tittel: "Anbefalt tiltakspakke",
      tekst: `Anbefalt pakke: ${tv.pakke.tiltak.map((t) => t.navn).join(" + ")}. Margin etter pakken: ${kr(tv.pakke.prognose.margin)}. Sannsynlighet: ${prosent(tv.pakke.prognose.sannsynlighetInsolvens)}.`,
    });
  }

  kunde.notater.forEach((n, i) => k.push({ id: `N-${i + 1}`, type: "Notat", tittel: `Notat (${n.forfatter})`, dato: n.dato, tekst: n.tekst }));
  for (const t of kunde.tekster) k.push({ id: `H-${t.id.replace(/^H-/, "")}`, type: "Hendelse", tittel: `${t.avsender}: ${t.tittel ?? ""}`.trim(), dato: t.dato, tekst: t.tekst });
  if (smitte.some((s) => s.fra === kunde.id || s.til === kunde.id)) {
    k.push({ id: "K-NETTVERK", type: "Bankdata", tittel: "Nettverk (internt, taushetsplikt)", tekst: "Kunden har betalingsstrømmer mot andre kunder i banken. Intern informasjon." });
  }
  return k;
}

// ---------- prompt ----------
export function lagPrompt(kunde: Kunde, katalog: Katalogkilde[]): string {
  return `Du er kredittanalytiker i Sparebanken Norge, bedriftsmarked. Lag en møterapport på ca. én side som rådgiveren skal lese før et møte med kunden ${kunde.navn} (${kunde.id}). Dagens dato i datagrunnlaget er ${DAGENS_DATO}.

REGLER
1. Bruk bare to typer kilder:
   a) KILDEKATALOG under (bankens egne data, prognose, score, tiltak, hendelser og notater).
   b) Nyheter og artikler du finner med websøk om bransjen (${kunde.bransje}), regionen (Vestland/${kunde.adresse}) og makro (renter, strømpriser, konkurser). Bruk 2–4 nettkilder fra de siste 12 månedene.
2. Bedriften er fiktiv. Ikke søk etter den, og ikke påstå noe om bedriften selv basert på nettet.
3. Hvert punkt skal ha minst én kilde i «kilder» med «id» (fra katalogen, eller W1, W2 … for nettkilder) og «sitat» kopiert ORDRETT fra kilden (maks ca. 25 ord). Sitater som ikke finnes ordrett i kilden, blir forkastet.
4. Skriv tall nøyaktig slik de står i kilden (samme format, f.eks. «1,5 MNOK» eller «421 000 kr»).
5. Nettkilder legges i «webkilder» med url (https), tittel, utgiver, publiseringsdato og et ordrett sitat fra artikkelen.
6. Ikke finn på noe. Det kildene ikke svarer på, skrives i «ikkeKjent».
7. Taushetsplikt: nevn aldri andre kunder i banken. Hvis katalogen viser en sensitiv situasjon, skal «varsomhet» beskrive den, og rapporten skal ikke foreslå salg eller press.
8. Skriv på norsk bokmål, kort og konkret. Rådgiveren tar beslutningene.
9. Svar KUN med gyldig JSON som følger JSON-SKJEMA. Ingen markdown, ingen kodeblokk, ingen tekst før eller etter.

JSON-SKJEMA
${JSON.stringify(rapportJsonSkjema())}

KILDEKATALOG
${JSON.stringify(katalog, null, 1)}
`;
}

// ---------- kontroll ----------
export const normaliser = (s: string) =>
  s
    .replace(/[«»"“”'‘’]/g, "")
    .replace(/[  ]/g, " ")
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Tall i en tekst, normalisert (mellomrom og tusenskiller fjernet, komma som desimaltegn)
export function tallI(tekst: string): string[] {
  return (tekst.replace(/[  ]/g, " ").match(/\d[\d ]*(?:[.,]\d+)?/g) ?? []).map((t) => t.replace(/\s/g, "").replace(".", ",")).filter((t) => t.length > 0);
}

export type Sitatstatus = "verifisert" | "ikke funnet" | "ukjent kilde" | "venter" | "kunne ikke hentes";

export interface Kontroll {
  sitater: { sti: string; id: string; sitat: string; status: Sitatstatus }[];
  tallUtenKilde: { sti: string; tall: string }[];
}

type PunktMedKilder = { tekst: string; kilder: { id: string; sitat: string }[] };

function allePunkter(r: Rapport): { sti: string; p: PunktMedKilder }[] {
  return [
    ...r.situasjon.map((p, i) => ({ sti: `situasjon[${i}]`, p })),
    ...r.risikoer.map((p, i) => ({ sti: `risikoer[${i}]`, p })),
    ...r.muligheter.map((p, i) => ({ sti: `muligheter[${i}]`, p })),
    ...r.bransjeOgMarked.map((p, i) => ({ sti: `bransjeOgMarked[${i}]`, p })),
    ...r.anbefaltTiltak.map((p, i) => ({ sti: `anbefaltTiltak[${i}]`, p })),
  ];
}

// Sjekker sitater mot katalogen lokalt; nettkilder får status fra serverens kontroll
export function kontroller(r: Rapport, katalog: Katalogkilde[], webStatus: Record<string, Sitatstatus>): Kontroll {
  const sitater: Kontroll["sitater"] = [];
  const tallUtenKilde: Kontroll["tallUtenKilde"] = [];
  for (const { sti, p } of allePunkter(r)) {
    const kildetekster: string[] = [];
    for (const ref of p.kilder) {
      const kat = katalog.find((k) => k.id === ref.id);
      const web = r.webkilder.find((w) => w.id === ref.id);
      let status: Sitatstatus;
      if (kat) {
        status = normaliser(kat.tekst).includes(normaliser(ref.sitat)) ? "verifisert" : "ikke funnet";
        kildetekster.push(kat.tekst);
      } else if (web) {
        // Sitatet i punktet må stå i webkildens sitat (som igjen sjekkes mot artikkelen)
        const iWebsitat = normaliser(web.sitat).includes(normaliser(ref.sitat)) || normaliser(ref.sitat).includes(normaliser(web.sitat));
        status = !iWebsitat ? "ikke funnet" : (webStatus[web.id] ?? "venter");
        kildetekster.push(web.sitat, web.tittel);
      } else {
        status = "ukjent kilde";
      }
      sitater.push({ sti, id: ref.id, sitat: ref.sitat, status });
    }
    const kildeTall = new Set(kildetekster.flatMap(tallI));
    const tekst = p.tekst.replace(/[\u00a0\u202f]/g, " ");
    for (const m of tekst.matchAll(/(\d[\d ]*(?:[.,]\d+)?)\s*(%|kr|MNOK|mill|dager|uker|prosent)?/g)) {
      const t = m[1].replace(/\s/g, "").replace(".", ",");
      // Årstall og ensifrede tall uten enhet (f.eks. «3 av 5») hoppes over; alt med enhet må finnes i kildene
      if (/^(19|20)\d\d$/.test(t) || (t.length === 1 && !m[2])) continue;
      if (!kildeTall.has(t)) tallUtenKilde.push({ sti, tall: `${t}${m[2] ? ` ${m[2]}` : ""}` });
    }
  }
  return { sitater, tallUtenKilde };
}

// Tolerant innlesing: fjerner ev. kodeblokk rundt JSON-svaret
export function lesSvar(tekst: string): unknown {
  const renset = tekst.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = renset.indexOf("{");
  const slutt = renset.lastIndexOf("}");
  return JSON.parse(start >= 0 ? renset.slice(start, slutt + 1) : renset);
}
