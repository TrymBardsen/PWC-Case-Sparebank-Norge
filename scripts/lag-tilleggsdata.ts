// Lager data/tilleggsdata.json: data en bank har i egne systemer (konto, transaksjoner,
// lån, sikkerheter, avviste betalinger) eller kan få med kundens samtykke (reskontro via
// regnskapssystemets API), pluss åpen bransjestatistikk fra SSB (data/ssb-konkurs.json).
//
// Alt bankdata er syntetisk, men konsistent med data/kundedata.json:
//  - saldo per 2026-10-01 er lik saldo i Engasjement
//  - mønstrene i merknadene (utnyttelse over 80 %, overtrekk, ståande saldo, kontantinnskot) gjenskapes
//  - innbetalinger følger årsomsetningen, lønn følger antall tilsette
//  - motpartsandelene i Hendingar (62 % og 51 %) gjenskapes
// Ingen nye «plantede» signaler: kunder uten merknad holdes unna terskelverdiene.
//
// Kjør: npm run tilleggsdata

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PER_DATO = "2026-10-01";
const START = "2024-09-30"; // mandag, 104 uker + dagene fram til PER_DATO
const DAGLIG_FRA = "2025-10-02"; // 365 dager med daglig saldo

// ---------- typer fra kundedata.json ----------
interface Bedrift {
  kunde_id: string;
  namn: string;
  bransje: string;
  nace: string;
  kommune: string;
  segment: string;
  eigarstruktur: string;
  dagleg_leiar: string;
  tilsette_2024: number;
  tilsette_2025: number;
  tilsette_2026: number;
  omsetning_2023_knok: number;
  omsetning_2024_knok: number;
  omsetning_2025_knok: number;
  driftsresultat_2025_knok: number;
  driftsmargin_2025_pst: number;
  eigenkapital_pst: number;
  risikoklasse: string;
  otp_hos_oss: string;
}
interface Engasjement {
  kunde_id: string;
  produkt: string;
  objekt_merknad: string | null;
  ramme_knok: number | null;
  saldo_knok: number | null;
  utnytting_pst: number | null;
  rente_pst: number | null;
  startdato: string | null;
  sluttdato: string | null;
  status: string;
  merknad: string | null;
}
interface Hending {
  kunde_id: string;
  dato: string;
  kjelde: string;
  kategori: string;
  hending: string;
}

const data = JSON.parse(readFileSync(new URL("../data/kundedata.json", import.meta.url), "utf8")) as {
  Bedrifter: Bedrift[];
  Engasjement: Engasjement[];
  Hendingar: Hending[];
};

// ---------- hjelpere ----------
function rng(frø: string) {
  let a = [...frø].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dato = (iso: string) => new Date(iso + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plussDagar = (s: string, n: number) => {
  const d = dato(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const dagarMellom = (a: string, b: string) => Math.round((dato(b).getTime() - dato(a).getTime()) / 86_400_000);
const vekedag = (s: string) => (dato(s).getUTCDay() + 6) % 7;
const rund = (x: number) => Math.round(x);

const DAGAR: string[] = [];
for (let d = START; d <= PER_DATO; d = plussDagar(d, 1)) DAGAR.push(d);
const IDAG = DAGAR.length - 1;
const DAGLIG_START = DAGAR.indexOf(DAGLIG_FRA);

// ---------- bransjegrupper (sesong, MVA, kostnadsstruktur) ----------
type Gruppe = "bygg" | "handel" | "servering" | "reiseliv" | "sjomat" | "industri" | "tenester" | "helse" | "barnehage" | "transport" | "daglegvare";
function gruppeFor(nace: string): Gruppe {
  const p2 = nace.slice(0, 2);
  if (["41", "43"].includes(p2) || nace === "49.410" || nace.startsWith("71")) return "bygg";
  if (nace === "47.110") return "daglegvare";
  if (["45", "47"].includes(p2)) return "handel";
  if (p2 === "55") return "reiseliv";
  if (p2 === "56" || nace === "10.710") return "servering";
  if (p2 === "79") return "reiseliv";
  if (p2 === "03" || nace.startsWith("10.2")) return "sjomat";
  if (["16", "18", "25", "26", "33"].includes(p2)) return "industri";
  if (["86", "75", "96", "93"].includes(p2)) return "helse";
  if (p2 === "88") return "barnehage";
  if (["49", "53"].includes(p2)) return "transport";
  return "tenester";
}
const SESONG: Record<Gruppe, number[]> = {
  bygg: [0.78, 0.82, 0.95, 1.04, 1.1, 1.14, 0.8, 1.04, 1.13, 1.12, 1.05, 0.83],
  handel: [0.82, 0.8, 0.92, 0.98, 1.04, 1.02, 0.95, 1.0, 0.96, 1.0, 1.1, 1.41],
  daglegvare: [0.95, 0.93, 0.98, 1.0, 1.02, 1.03, 1.05, 1.0, 0.97, 0.99, 1.0, 1.08],
  servering: [0.9, 0.95, 1.02, 1.0, 1.05, 1.0, 0.65, 0.95, 1.08, 1.1, 1.12, 1.18],
  reiseliv: [0.6, 0.65, 0.8, 0.9, 1.15, 1.45, 1.65, 1.45, 1.05, 0.8, 0.7, 0.8],
  sjomat: [1.3, 1.35, 1.25, 1.1, 0.95, 0.85, 0.7, 0.75, 0.85, 0.95, 1.0, 0.95],
  industri: [0.97, 1.0, 1.05, 1.02, 1.03, 1.02, 0.72, 0.98, 1.06, 1.06, 1.05, 1.04],
  tenester: [0.98, 1.0, 1.05, 1.0, 1.02, 1.03, 0.7, 0.96, 1.07, 1.07, 1.06, 1.06],
  helse: [1.0, 1.02, 1.03, 1.0, 1.02, 1.0, 0.75, 0.95, 1.05, 1.06, 1.06, 1.06],
  barnehage: [1.02, 1.02, 1.02, 1.02, 1.02, 1.02, 0.78, 0.98, 1.03, 1.03, 1.03, 1.03],
  transport: [0.94, 0.95, 1.0, 1.0, 1.03, 1.03, 0.92, 0.98, 1.02, 1.03, 1.04, 1.06],
};
const MVA: Record<Gruppe, number> = {
  bygg: 0.25, handel: 0.25, daglegvare: 0.15, servering: 0.25, reiseliv: 0.12, sjomat: 0.15, industri: 0.25, tenester: 0.25, helse: 0.25, barnehage: 0, transport: 0.25,
};
// Brutto årslønn per tilsett (kNOK), andel husleige og straum av omsetning
const LONN: Record<Gruppe, number> = { bygg: 620, handel: 470, daglegvare: 430, servering: 400, reiseliv: 420, sjomat: 650, industri: 600, tenester: 700, helse: 640, barnehage: 520, transport: 560 };
const HUSLEIGE: Record<Gruppe, number> = { bygg: 0.02, handel: 0.06, daglegvare: 0.04, servering: 0.07, reiseliv: 0.06, sjomat: 0.015, industri: 0.03, tenester: 0.05, helse: 0.07, barnehage: 0.08, transport: 0.02 };
const STRAUM: Record<Gruppe, number> = { bygg: 0.007, handel: 0.015, daglegvare: 0.025, servering: 0.03, reiseliv: 0.035, sjomat: 0.03, industri: 0.03, tenester: 0.005, helse: 0.012, barnehage: 0.015, transport: 0.006 };
const STRAUM_SESONG = [1.5, 1.45, 1.25, 1.0, 0.8, 0.65, 0.6, 0.65, 0.8, 1.05, 1.3, 1.45];
const B2C: Gruppe[] = ["handel", "daglegvare", "servering", "reiseliv", "helse"];
const MVA_FORFALL: [number, number][] = [[1, 10], [3, 10], [5, 10], [7, 31], [9, 10], [11, 10]]; // [månad (0-indeksert), dag]
const SKATT_MND = [0, 2, 4, 6, 8, 10];

// Fiktive motpartsnavn (betalarar). Sjekkes mot porteføljen så ingen er kunde.
// Konstruerte namn i same stil som kundedata (Briskberg, Myrmark …), så dei ikkje liknar ekte selskap
const FORLEDD = ["Brisk", "Myr", "Grå", "Lyng", "Kvit", "Rogn", "Sel", "Ulv", "Tind", "Fur", "Skjel", "Hval", "Bjørk", "Ask", "Stav", "Vård"];
const ETTERLEDD = ["mo", "vågen", "heim", "strand", "nesset", "lid", "øyna", "bakk", "fjell", "sund"];
const SUFFIKS = ["Eigedom AS", "Bygg AS", "Industri AS", "Handel AS", "Holding AS", "Drift AS", "Service AS", "Gruppen AS", "Logistikk AS", "Utvikling AS"];
const STAMMER = FORLEDD.flatMap((f) => ETTERLEDD.map((e) => f + e));
const KUNDENAMN = new Set(data.Bedrifter.map((b) => b.namn));

// ---------- tolking av merknader og hendingar ----------
const eng = (id: string) => data.Engasjement.filter((e) => e.kunde_id === id);
const hend = (id: string) => data.Hendingar.filter((h) => h.kunde_id === id);

interface Monster {
  kkBand?: { fra: string; min: number; maks: number }; // utnytting i band frå dato
  overtrekkDagar?: string[];
  driftskontoMin?: { fra: string; min: number };
  kontantinnskot?: { fra: string; til: string; antal: number; sum: number };
  motpart?: { namn: string; andel: number; anmerkning: string };
  ubrukt?: boolean;
}

function finnMonster(id: string, kk: Engasjement | undefined): Monster {
  const m: Monster = {};
  const merk = eng(id).map((e) => ({ p: e.produkt, m: e.merknad ?? "" }));
  for (const { p, m: t } of merk) {
    let r: RegExpMatchArray | null;
    if (p === "Kassakreditt" && (r = t.match(/Utnytta (\d+) til (\d+) % kvar månad sidan (\d{4}-\d{2})/))) m.kkBand = { fra: `${r[3]}-01`, min: +r[1], maks: +r[2] };
    else if (p === "Kassakreditt" && (r = t.match(/Utnytta over (\d+) % kvar månad sidan (\d{4}-\d{2})/))) m.kkBand = { fra: `${r[2]}-01`, min: +r[1] + 2, maks: 97 };
    if (p === "Kassakreditt" && t === "Ubrukt") m.ubrukt = true;
    if (p === "Kassakreditt" && t.startsWith("Overtrekk to gonger i juni og juli 2026")) m.overtrekkDagar = ["2026-06-19", "2026-07-20"];
    if (p === "Driftskonto" && (r = t.match(/Saldo over (\d) mill\. (?:ståande|samanhengande) sidan (\d{4}-\d{2})/))) m.driftskontoMin = { fra: `${r[2]}-01`, min: +r[1] * 1000 };
  }
  for (const h of hend(id)) {
    let r: RegExpMatchArray | null;
    if (h.kategori === "Kreditt" && h.hending.startsWith("Overtrekk") && !m.overtrekkDagar) {
      // Overtrekket som utløste purringa + eitt til innanfor siste tre månader
      const andre = plussDagar(h.dato, h.dato > "2026-08-01" ? -37 : 23);
      m.overtrekkDagar = [...new Set([...(m.overtrekkDagar ?? []), plussDagar(h.dato, -1), andre])].filter((d) => d <= PER_DATO).sort().slice(-2);
    }
    if (h.kategori === "Transaksjon" && (r = h.hending.match(/Kontantinnskot på til saman ([\d,]+) mill\. fordelt på (\d+) innskot (i juni og juli 2026|siste to månader)/))) {
      const sum = Number(r[1].replace(",", ".")) * 1000;
      m.kontantinnskot = r[3].startsWith("i juni") ? { fra: "2026-06-01", til: "2026-07-31", antal: +r[2], sum } : { fra: plussDagar(h.dato, -61), til: plussDagar(h.dato, -1), antal: +r[2], sum };
    }
    if (h.kategori === "Motpart" && (r = h.hending.match(/(\d+) % av innbetalingane i 2026 kjem frå (.+?)\. Motparten fekk betalingsanmerkning registrert (\d{4}-\d{2}-\d{2})/))) {
      m.motpart = { namn: r[2], andel: +r[1] / 100, anmerkning: r[3] };
    }
  }
  if (kk && (kk.merknad ?? "").startsWith("Overtrekk to gonger siste tre månader") && !m.overtrekkDagar) m.overtrekkDagar = ["2026-07-24", "2026-09-08"];
  return m;
}

// ---------- lån og leasing ----------
interface LanRad {
  kunde_id: string;
  produkt: string;
  objekt: string | null;
  lanetype: string;
  opphavleg_belop_knok: number;
  saldo_knok: number;
  rente_pst: number;
  termin_frekvens: string;
  avdrag_per_termin_knok: number;
  terminbelop_knok: number;
  neste_forfall: string;
  startdato: string | null;
  sluttdato: string;
  sluttbetaling_knok: number;
  forfalne_terminar: number;
  forfalt_belop_knok: number;
}

function lanFor(b: Bedrift, distress: boolean): LanRad[] {
  const rader: LanRad[] = [];
  for (const e of eng(b.kunde_id)) {
    if (!["Nedbetalingslån", "Leasing"].includes(e.produkt) || e.status !== "Aktiv" || !e.saldo_knok || !e.sluttdato) continue;
    const mnd = (a: string, b2: string) => Math.max(1, Math.round(dagarMellom(a, b2) / 30.44));
    const totalt = e.startdato ? mnd(e.startdato, e.sluttdato) : mnd(PER_DATO, e.sluttdato) * 2;
    const igjen = mnd(PER_DATO, e.sluttdato);
    const rente = e.rente_pst ?? 7;
    const serie = e.produkt === "Nedbetalingslån";
    // Avdrag ut frå opphavleg beløp og løpetid. Det som står att ved slutt, er sluttbetaling (restverdi).
    const opphavleg = e.ramme_knok ?? Math.min(e.saldo_knok * 3, (e.saldo_knok * totalt) / Math.max(igjen, 1));
    const avdrag = opphavleg / totalt;
    const termin = avdrag + (e.saldo_knok * rente) / 100 / 12;
    const sluttbetaling = Math.max(0, e.saldo_knok - avdrag * igjen);
    const forfalne = distress && rader.length === 0 ? 1 : 0;
    rader.push({
      kunde_id: b.kunde_id,
      produkt: e.produkt,
      objekt: e.objekt_merknad,
      lanetype: serie ? "Serielån" : "Leasing",
      opphavleg_belop_knok: rund(opphavleg),
      startdato: e.startdato,
      saldo_knok: e.saldo_knok,
      rente_pst: rente,
      termin_frekvens: "Månadleg",
      avdrag_per_termin_knok: Math.round(avdrag * 10) / 10,
      terminbelop_knok: Math.round(termin * 10) / 10,
      neste_forfall: serie ? "2026-10-20" : "2026-11-01",
      sluttdato: e.sluttdato,
      sluttbetaling_knok: rund(sluttbetaling),
      forfalne_terminar: forfalne,
      forfalt_belop_knok: forfalne ? Math.round(termin) : 0,
    });
  }
  return rader;
}

// ---------- hovudsimulering per kunde ----------
type Kategori = "kundar" | "kort" | "kontant" | "anna_inn" | "lonn" | "skattetrekk_aga" | "mva" | "selskapsskatt" | "otp" | "husleige" | "straum" | "lan_leasing" | "leverandorar" | "anna_ut";
const INN: Kategori[] = ["kundar", "kort", "kontant", "anna_inn"];
const UT: Kategori[] = ["lonn", "skattetrekk_aga", "mva", "selskapsskatt", "otp", "husleige", "straum", "lan_leasing", "leverandorar", "anna_ut"];

function simuler(b: Bedrift) {
  const r = rng(b.kunde_id);
  const g = gruppeFor(b.nace);
  const engasjement = eng(b.kunde_id);
  const kk = engasjement.find((e) => e.produkt === "Kassakreditt" && e.status === "Aktiv");
  const driftskonto = engasjement.find((e) => e.produkt === "Driftskonto")!;
  const harKort = engasjement.some((e) => e.produkt === "Kortterminal" && e.status === "Aktiv");
  const harPlassering = engasjement.some((e) => e.produkt === "Plasseringskonto" && e.status === "Aktiv");
  const eigedom = engasjement.some((e) => /eigedom/i.test(e.objekt_merknad ?? ""));
  const m = finnMonster(b.kunde_id, kk);
  const distress = hend(b.kunde_id).some((h) => h.kategori === "Kreditt" && h.hending.startsWith("Overtrekk"));
  const restskatt = hend(b.kunde_id).find((h) => h.kategori === "Betalingsanmerkning");
  const lan = lanFor(b, distress);

  // Omsetning per kalenderår (kNOK, ekskl. MVA)
  const vekst25 = b.omsetning_2025_knok / b.omsetning_2024_knok - 1;
  const oms: Record<number, number> = { 2024: b.omsetning_2024_knok, 2025: b.omsetning_2025_knok, 2026: b.omsetning_2025_knok * (1 + Math.max(-0.15, Math.min(0.25, vekst25 * 0.5))) };
  const tilsette: Record<number, number> = { 2024: b.tilsette_2024, 2025: b.tilsette_2025, 2026: b.tilsette_2026 };
  const mva = MVA[g];
  const b2c = B2C.includes(g) || harKort;
  const kortandel = harKort ? (B2C.includes(g) ? 0.75 : 0.35) : 0;

  // Lønnskostnad avgrensa så ho ikkje overstig 75 % av kostnadene
  const kostnad25 = b.omsetning_2025_knok - b.driftsresultat_2025_knok;
  const lonnFaktor = Math.min(1, (kostnad25 * 0.75) / (b.tilsette_2025 * LONN[g] * 1.17));

  const flyt: Record<Kategori, number[]> = Object.fromEntries([...INN, ...UT].map((k) => [k, new Array(DAGAR.length).fill(0)])) as Record<Kategori, number[]>;
  const innPerMnd = new Map<string, number>();

  // 1. Innbetalingar på kvardagar
  const sesongSnitt = SESONG[g].reduce((s, x) => s + x, 0) / 12;
  for (let i = 0; i < DAGAR.length; i++) {
    const d = dato(DAGAR[i]);
    const helg = vekedag(DAGAR[i]) >= 5;
    if (helg && !b2c) continue;
    const dagarIVeka = b2c ? 7 : 5;
    const nivaa = ((oms[d.getUTCFullYear()] * (1 + mva)) / 52 / dagarIVeka) * (SESONG[g][d.getUTCMonth()] / sesongSnitt);
    const stoy = Math.max(0.05, 1 + (r() - 0.5) * (b2c ? 0.6 : 1.4));
    const sum = nivaa * stoy;
    flyt.kort[i] += sum * kortandel;
    flyt.kundar[i] += sum * (1 - kortandel);
    const n = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    innPerMnd.set(n, (innPerMnd.get(n) ?? 0) + sum / (1 + mva));
  }
  if (m.kontantinnskot) {
    const k = m.kontantinnskot;
    const fra = DAGAR.indexOf(k.fra);
    const lengd = dagarMellom(k.fra, k.til);
    for (let j = 0; j < k.antal; j++) {
      const i = fra + Math.round(((j + 0.5) * lengd) / k.antal);
      flyt.kontant[i] += k.sum / k.antal;
    }
  }

  // 2. Kjende utbetalingar
  for (let i = 0; i < DAGAR.length; i++) {
    const d = dato(DAGAR[i]);
    const aar = d.getUTCFullYear();
    const mnd = d.getUTCMonth();
    const dag = d.getUTCDate();
    const brutto = (tilsette[aar] * LONN[g] * lonnFaktor) / 12;
    if (dag === 20) {
      flyt.lonn[i] += brutto * (mnd === 11 ? 0.85 : 0.7) + (mnd === 5 ? brutto * 12 * 0.102 * 0.7 : 0);
      for (const l of lan) {
        if (l.produkt === "Nedbetalingslån" && DAGAR[i] >= (l.startdato ?? START)) flyt.lan_leasing[i] += l.terminbelop_knok;
      }
    }
    if (dag === 1) {
      if (!eigedom && b.eigarstruktur !== "Dotterselskap") flyt.husleige[i] += (oms[aar] * HUSLEIGE[g]) / 12;
      for (const l of lan) if (l.produkt === "Leasing" && DAGAR[i] >= (l.startdato ?? START)) flyt.lan_leasing[i] += l.terminbelop_knok;
    }
    if (dag === 15 && SKATT_MND.includes(mnd)) flyt.skattetrekk_aga[i] += brutto * 2 * (0.3 + 0.141);
    if (dag === 15) flyt.straum[i] += ((oms[aar] * STRAUM[g]) / 12) * STRAUM_SESONG[mnd];
    if (dag === 25) flyt.otp[i] += brutto * 0.025;
    if (dag === 15 && (mnd === 1 || mnd === 3) && b.driftsresultat_2025_knok > 0) {
      // Forskotsskatt; ubetalt for kundar med registrert restskatt
      const ubetalt = restskatt && aar === 2026;
      if (!ubetalt) flyt.selskapsskatt[i] += b.driftsresultat_2025_knok * 0.22 * 0.5;
    }
    for (const [fm, fd] of MVA_FORFALL) {
      if (mnd === fm && dag === fd && mva > 0) {
        const grunnlag = [3, 2].reduce((s, tilbake) => {
          const t = new Date(Date.UTC(aar, mnd - tilbake, 1));
          return s + (innPerMnd.get(`${t.getUTCFullYear()}-${t.getUTCMonth()}`) ?? (oms[aar] / 12));
        }, 0);
        const verdiauke = Math.min(0.6, (brutto * 12 * 1.17) / oms[aar] + b.driftsmargin_2025_pst / 100 + 0.05);
        flyt.mva[i] += grunnlag * verdiauke * mva;
      }
    }
  }

  // 3. Leverandørar: resten av kostnadene jamt på kvardagar
  const kjendeSum = UT.filter((k) => k !== "leverandorar" && k !== "anna_ut").reduce((s, k) => s + flyt[k].reduce((a, x) => a + x, 0), 0);
  const innSum = INN.reduce((s, k) => s + flyt[k].reduce((a, x) => a + x, 0), 0);
  const levTotal = Math.max(innSum * 0.1, innSum - kjendeSum - (b.driftsresultat_2025_knok * DAGAR.length) / 365 * 0.6);
  const kvardagar = DAGAR.filter((d) => vekedag(d) < 5).length;
  for (let i = 0; i < DAGAR.length; i++) if (vekedag(DAGAR[i]) < 5) flyt.leverandorar[i] += (levTotal / kvardagar) * (0.4 + r() * 1.2);

  // 4. Saldo (P = driftskonto − trekk på kassakreditt). Svingingane kjem frå dei faktiske betalingane
  //    (lønningsdagar, MVA, innbetalingar); nivået følgjer ein jamn bane som endar i dagens saldo.
  const kkTrekk = kk?.saldo_knok ?? 0;
  const ramme = kk?.ramme_knok ?? 0;
  const dIdag = driftskonto.saldo_knok ?? 0;
  const pIdag = dIdag - kkTrekk;
  const netto = DAGAR.map((_, i) => INN.reduce((s, k) => s + flyt[k][i], 0) - UT.reduce((s, k) => s + flyt[k][i], 0));
  const raa: number[] = [];
  netto.reduce((s, x, i) => (raa[i] = s + x), 0);
  // Avvik frå 31-dagars glidande snitt = kortsiktige svingingar i kontantstraumen
  const avvik = raa.map((x, i) => {
    const fra = Math.max(0, i - 15);
    const til = Math.min(raa.length, i + 16);
    return x - raa.slice(fra, til).reduce((s, y) => s + y, 0) / (til - fra);
  });
  const sortert = [...avvik].map(Math.abs).sort((x, y) => x - y);
  const amplitude = sortert[Math.floor(sortert.length * 0.95)] || 1;

  // Driftskonto når kassekreditten er i bruk: lite buffer (eller dagens saldo om KK er trekt i dag)
  const buffer = kk ? (kkTrekk > 0 ? dIdag : Math.min(pIdag, Math.max(50, Math.min(400, b.omsetning_2025_knok / 100)))) : 0;
  const hogUtanMerknad = !m.driftskontoMin && !harPlassering && dIdag > 2600;
  // Buffer over tid: for kundar med høg saldo i dag har bufferen vakse dei siste 10 vekene
  const bufferAt = (i: number) => {
    if (!hogUtanMerknad || buffer <= 300) return buffer;
    const rampStart = IDAG - 70;
    return i < rampStart ? 300 : 300 + ((buffer - 300) * (i - rampStart)) / 70;
  };

  // Nivåbane L(t): lineær frå startnivå til dagens saldo, med tilpassingar for mønstera i kundedata
  const startNivaa = pIdag + (r() - 0.5) * (b.omsetning_2025_knok / 12) * 0.6;
  const L = DAGAR.map((_, i) => startNivaa + ((pIdag - startNivaa) * i) / IDAG);
  const overgang = (fra: number, maal: (i: number) => number) => {
    // Glir over til eit nytt nivå i løpet av 45 dagar før vindauget startar
    for (let i = Math.max(0, fra - 45); i <= IDAG; i++) {
      const w = i >= fra ? 1 : (i - (fra - 45)) / 45;
      L[i] = L[i] * (1 - w) + maal(i) * w;
    }
  };
  if (kk && m.kkBand) {
    const fra = DAGAR.indexOf(m.kkBand.fra);
    const midt = (m.kkBand.min + m.kkBand.maks) / 200;
    overgang(fra, (i) => buffer - (midt + ((kkTrekk / ramme - midt) * Math.max(0, i - (IDAG - 30))) / 30) * ramme);
  }
  if (m.driftskontoMin) {
    const fra = DAGAR.indexOf(m.driftskontoMin.fra);
    overgang(fra, (i) => Math.max(L[i], m.driftskontoMin!.min + 1.3 * amplitude + 150));
  }
  // Høg saldo i dag utan merknad: saldoen har vakse til dagens nivå dei siste 10 vekene (ingen ståande saldo over 3 mill.)
  if (hogUtanMerknad) {
    const lagt = Math.min(2300, dIdag) - amplitude * 0.2;
    const rampStart = IDAG - 70;
    for (let i = 0; i <= IDAG; i++) L[i] = i < rampStart ? Math.min(L[i], lagt) : lagt + ((pIdag - lagt) * (i - rampStart)) / 70;
  }
  // Kassekreditt utan merknad: hald trekket godt under 80 % av ramma
  if (kk && !m.kkBand && ramme > 0) for (let i = 0; i <= IDAG; i++) L[i] = Math.max(L[i], bufferAt(i) - 0.5 * ramme + amplitude * 0.3 - (i > IDAG - 20 ? ramme : 0));

  // Kalibrer leverandørbetalingane så den underliggjande driften følgjer nivåbanen (minst mogleg «anna inn»)
  {
    const drift = raa[IDAG] - raa[0] - (L[IDAG] - L[0]);
    const kvardagIdx = DAGAR.map((d, i) => (vekedag(d) < 5 ? i : -1)).filter((i) => i >= 0);
    for (const i of kvardagIdx) {
      const innDag = INN.reduce((s, k) => s + flyt[k][i], 0);
      flyt.leverandorar[i] = Math.max(innDag * 0.05, flyt.leverandorar[i] + drift / kvardagIdx.length);
    }
  }
  const P = L.map((l, i) => l + avvik[i]);
  // Den siste månaden glir mot dagens saldo, så siste dag er eksakt
  for (let i = IDAG - 20; i <= IDAG; i++) {
    const w = (i - (IDAG - 20)) / 20;
    P[i] = P[i] * (1 - w) + pIdag * w;
  }

  // 5. Fordel på driftskonto (D) og trekk på kassakreditt (K), og avgrens til mønstera
  const D = new Array(P.length).fill(0);
  const K = new Array(P.length).fill(0);
  for (let i = 0; i <= IDAG; i++) {
    let p = P[i];
    const buf = bufferAt(i);
    if (kk && ramme > 0) {
      const buffer = buf;
      const u = Math.max(0, buffer - p) / ramme;
      if (m.kkBand && DAGAR[i] >= m.kkBand.fra) {
        // Dagleg kan utnyttinga svinge (lønningsdagar), men aldri overtrekk. Månadssnittet styrast under.
        p = buffer - Math.min(0.995, Math.max(0.55, u)) * ramme;
      } else if (m.overtrekkDagar?.includes(DAGAR[i])) {
        p = buffer - ramme * (1.03 + r() * 0.05);
      } else {
        const tak = i > IDAG - 20 && kkTrekk / ramme >= 0.75 ? 0.995 : m.overtrekkDagar ? 0.97 : 0.78;
        if (u > tak) p = buffer - tak * ramme;
      }
      if (m.ubrukt) p = Math.max(p, buffer);
    } else if (!kk) {
      p = Math.max(p, 20);
    }
    if (m.driftskontoMin && DAGAR[i] >= m.driftskontoMin.fra) p = Math.max(p, m.driftskontoMin.min + 30);
    P[i] = p;
    D[i] = kk ? Math.max(p, buf) : p;
    K[i] = kk ? Math.max(0, buf - p) : 0;
  }
  // Månadssnittet av utnyttinga skal ligge i bandet frå merknaden («kvar månad sidan …»)
  if (kk && ramme > 0 && m.kkBand) {
    const fra = DAGAR.indexOf(m.kkBand.fra);
    const lo = m.kkBand.min / 100 + 0.01;
    const hi = m.kkBand.maks / 100 - 0.01;
    for (let runde = 0; runde < 4; runde++) {
      let i = fra;
      while (i <= IDAG) {
        const d = dato(DAGAR[i]);
        const sisteIMnd = DAGAR.indexOf(iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))));
        const slutt = sisteIMnd < 0 ? IDAG : Math.min(IDAG, sisteIMnd);
        const idx = Array.from({ length: slutt - i + 1 }, (_, j) => i + j);
        const snitt = idx.reduce((s2, j) => s2 + K[j], 0) / idx.length / ramme;
        const maal = Math.min(hi, Math.max(lo, snitt));
        for (const j of idx) {
          const buf = bufferAt(j);
          const u = Math.min(0.995, Math.max(0.5, K[j] / ramme + (maal - snitt)));
          P[j] = buf - u * ramme;
          D[j] = Math.max(P[j], buf);
          K[j] = Math.max(0, buf - P[j]);
        }
        i = slutt + 1;
      }
    }
  }
  P[IDAG] = pIdag;
  D[IDAG] = dIdag;
  K[IDAG] = kkTrekk;

  // 6. Avstem: endring i saldo = inn − ut. Leverandørbetalingane tek differansen; blir dei negative,
  //    er det pengar inn utover kundebetalingane (overføring frå anna konto, innskot).
  for (let i = 1; i < P.length; i++) {
    const kjentNetto = INN.reduce((s, k) => s + flyt[k][i], 0) - UT.filter((k) => k !== "leverandorar" && k !== "anna_ut").reduce((s, k) => s + flyt[k][i], 0);
    const lev = kjentNetto - (P[i] - P[i - 1]);
    flyt.leverandorar[i] = Math.max(0, lev);
    flyt.anna_ut[i] = 0;
    if (lev < 0) flyt.anna_inn[i] += -lev;
  }

  // 7. Betalarar (kven innbetalingane kjem frå)
  const betalarar: { namn: string; type: string; andel: number }[] = [];
  if (b2c) {
    if (kortandel > 0) betalarar.push({ namn: "Kortoppgjer (terminal)", type: "Kortoppgjer", andel: kortandel });
    betalarar.push({ namn: "Vipps-oppgjer og privatkundar", type: "Privat", andel: 1 - kortandel });
  } else {
    const n = 3 + Math.floor(r() * 4);
    const vekter = Array.from({ length: n }, (_, j) => Math.pow(r() * 0.8 + 0.2, 1.6) * (j === 0 ? 1.6 : 1));
    let rest = 0.82;
    if (m.motpart) {
      betalarar.push({ namn: m.motpart.namn, type: "Næring", andel: m.motpart.andel });
      rest = 0.95 - m.motpart.andel;
    }
    const sumV = vekter.reduce((s, x) => s + x, 0);
    const brukt = new Set<string>();
    for (let j = 0; j < n; j++) {
      let namn = "";
      do namn = `${STAMMER[Math.floor(r() * STAMMER.length)]} ${SUFFIKS[Math.floor(r() * SUFFIKS.length)]}`;
      while (brukt.has(namn) || KUNDENAMN.has(namn));
      brukt.add(namn);
      betalarar.push({ namn, type: "Næring", andel: (vekter[j] / sumV) * rest * (m.motpart ? 1 : 1) });
    }
    const kommunal = hend(b.kunde_id).find((h) => h.kategori === "Kontrakt");
    betalarar.push({ namn: kommunal ? `${b.kommune} kommune` : "Andre kundar", type: kommunal ? "Offentleg" : "Næring", andel: 1 - betalarar.reduce((s, x) => s + x.andel, 0) });
  }

  return { flyt, D, K, betalarar, lan, m, g, b2c, ramme, kk };
}

// ---------- reskontro (samtykke) ----------
function reskontroFor(b: Bedrift, sim: ReturnType<typeof simuler>, r: () => number) {
  if (sim.b2c) {
    return { kundefordringar: [], leverandorgjeld_forfalt_knok: rund(r() * 60), skatt_mva_restanse_knok: restanseFor(b) };
  }
  const siste6Veker = sim.flyt.kundar.slice(-42).reduce((s, x) => s + x, 0);
  const fordringar: { debitor: string; belop_knok: number; fakturadato: string; forfall: string; snitt_dagar_etter_forfall: number }[] = [];
  for (const bet of sim.betalarar.filter((x) => x.type !== "Kortoppgjer" && x.andel > 0.04)) {
    const motpart = sim.m.motpart?.namn === bet.namn;
    const forsinking = motpart ? 38 + Math.round(r() * 15) : Math.round(r() * 12);
    const total = siste6Veker * bet.andel * (motpart ? 1.4 : 1);
    const antal = 1 + Math.floor(r() * 3);
    for (let j = 0; j < antal; j++) {
      const fakturadato = plussDagar(PER_DATO, -Math.round(5 + r() * (motpart ? 80 : 40)));
      fordringar.push({ debitor: bet.namn, belop_knok: rund(total / antal), fakturadato, forfall: plussDagar(fakturadato, 30), snitt_dagar_etter_forfall: forsinking });
    }
  }
  return { kundefordringar: fordringar.sort((a, c) => a.forfall.localeCompare(c.forfall)), leverandorgjeld_forfalt_knok: rund(r() * 80), skatt_mva_restanse_knok: restanseFor(b) };
}
function restanseFor(b: Bedrift) {
  const h = hend(b.kunde_id).find((x) => x.kategori === "Betalingsanmerkning");
  const r = h?.hending.match(/Restskatt ([\d ]+) ubetalt/);
  return r ? Number(r[1].replace(/\s/g, "")) / 1000 : 0;
}

// ---------- sikkerheiter ----------
function sikkerheiterFor(b: Bedrift, r: () => number) {
  const rader: { kunde_id: string; type: string; sikrar: string; verdi_knok: number; prioritet: number; vurdert: string }[] = [];
  for (const e of eng(b.kunde_id)) {
    if (e.status !== "Aktiv") continue;
    const o = e.objekt_merknad ?? "";
    if (e.produkt === "Nedbetalingslån" && /eigedom/i.test(o)) rader.push({ kunde_id: b.kunde_id, type: "Pant i fast eigedom", sikrar: e.produkt, verdi_knok: rund((e.ramme_knok ?? 0) * (1.3 + r() * 0.3)), prioritet: 1, vurdert: "2025-03-01" });
    else if (e.produkt === "Nedbetalingslån" && /bil|maskin|utstyr|lift|gravar|lastebil/i.test(o)) rader.push({ kunde_id: b.kunde_id, type: "Pant i driftstilbehør/motorvogn", sikrar: e.produkt, verdi_knok: rund((e.saldo_knok ?? 0) * (0.7 + r() * 0.4)), prioritet: 1, vurdert: "2025-06-01" });
    else if (e.produkt === "Leasing") rader.push({ kunde_id: b.kunde_id, type: "Eigarskap til leasingobjekt", sikrar: e.produkt, verdi_knok: rund((e.saldo_knok ?? 0) * (0.8 + r() * 0.3)), prioritet: 1, vurdert: "2025-06-01" });
    else if (e.produkt === "Kassakreditt" && (e.ramme_knok ?? 0) > 0) rader.push({ kunde_id: b.kunde_id, type: "Pant i varelager og kundefordringar", sikrar: e.produkt, verdi_knok: rund((e.ramme_knok ?? 0) * (0.5 + r() * 0.4)), prioritet: 1, vurdert: "2026-01-15" });
  }
  const kk = eng(b.kunde_id).find((e) => e.produkt === "Kassakreditt" && e.status === "Aktiv");
  if (kk && ["C", "D", "E"].includes(b.risikoklasse) && ["Eineeigar", "To eigarar", "Familieeigd"].includes(b.eigarstruktur)) {
    rader.push({ kunde_id: b.kunde_id, type: "Sjølvskuldnarkausjon frå eigar", sikrar: "Kassakreditt", verdi_knok: kk.ramme_knok ?? 0, prioritet: 2, vurdert: "2024-09-01" });
  }
  return rader;
}

// ---------- køyr ----------
const kontoHistorikk: Record<string, { driftskonto_knok: number[]; kassakreditt_trekk_knok: number[] | null; kassakreditt_ramme_knok: number | null }> = {};
const kontantstraum: Record<string, { veke_fra: string[]; inn: Record<string, number[]>; ut: Record<string, number[]> }> = {};
const betalarar: Record<string, { namn: string; type: string; sum_2025_knok: number; sum_2026_hittil_knok: number; andel_2026_pst: number }[]> = {};
const lan: LanRad[] = [];
const sikkerheiter: ReturnType<typeof sikkerheiterFor> = [];
const avvisteBetalingar: { kunde_id: string; dato: string; belop_knok: number; mottakar: string; arsak: string }[] = [];
const samtykke: Record<string, { rekneskapsdata: boolean; system: string | null; gitt: string | null }> = {};
const reskontro: Record<string, ReturnType<typeof reskontroFor>> = {};

const SYSTEM = ["Tripletex", "Fiken", "Visma eAccounting", "PowerOffice Go"];
for (const b of data.Bedrifter) {
  const sim = simuler(b);
  const r = rng(b.kunde_id + "-ekstra");

  kontoHistorikk[b.kunde_id] = {
    driftskonto_knok: sim.D.slice(DAGLIG_START).map(rund),
    kassakreditt_trekk_knok: sim.kk ? sim.K.slice(DAGLIG_START).map(rund) : null,
    kassakreditt_ramme_knok: sim.kk ? sim.ramme : null,
  };

  const veker = { veke_fra: [] as string[], inn: {} as Record<string, number[]>, ut: {} as Record<string, number[]> };
  for (const k of INN) veker.inn[k] = [];
  for (const k of UT) veker.ut[k] = [];
  for (let w = 0; w < 104; w++) {
    const fra = w * 7;
    const sumKat = (k: Kategori) => rund(sim.flyt[k].slice(fra, fra + 7).reduce((s, x) => s + x, 0));
    veker.veke_fra.push(DAGAR[fra]);
    for (const k of INN) veker.inn[k].push(sumKat(k));
    for (const k of UT) veker.ut[k].push(sumKat(k));
  }
  kontantstraum[b.kunde_id] = veker;

  const i2026 = DAGAR.indexOf("2026-01-01");
  const i2025 = DAGAR.indexOf("2025-01-01");
  const kundeInn = (fra: number, til: number) => ["kundar", "kort"].reduce((s, k) => s + sim.flyt[k as Kategori].slice(fra, til).reduce((a, x) => a + x, 0), 0);
  const sum25 = kundeInn(i2025, i2026);
  const sum26 = kundeInn(i2026, IDAG + 1);
  betalarar[b.kunde_id] = sim.betalarar
    .filter((x) => x.andel > 0.005)
    .map((x) => ({ namn: x.namn, type: x.type, sum_2025_knok: rund(sum25 * x.andel * (sim.m.motpart?.namn === x.namn ? 0.85 : 1)), sum_2026_hittil_knok: rund(sum26 * x.andel), andel_2026_pst: rund(x.andel * 100) }))
    .sort((a, c) => c.andel_2026_pst - a.andel_2026_pst);

  lan.push(...sim.lan);
  sikkerheiter.push(...sikkerheiterFor(b, r));

  // Avviste betalingar: rundt overtrekk, og sjeldan ved høg utnytting
  for (const d of sim.m.overtrekkDagar ?? []) {
    avvisteBetalingar.push({ kunde_id: b.kunde_id, dato: d, belop_knok: rund(40 + r() * 200), mottakar: "Leverandør", arsak: "Manglande dekning" });
    if (r() < 0.6) avvisteBetalingar.push({ kunde_id: b.kunde_id, dato: plussDagar(d, 1), belop_knok: rund(20 + r() * 120), mottakar: "Leverandør", arsak: "Manglande dekning" });
  }
  if (sim.m.kkBand && r() < 0.5) avvisteBetalingar.push({ kunde_id: b.kunde_id, dato: plussDagar(PER_DATO, -Math.round(10 + r() * 60)), belop_knok: rund(30 + r() * 100), mottakar: "Leverandør", arsak: "Manglande dekning" });

  const gitt = r() < 0.45;
  samtykke[b.kunde_id] = { rekneskapsdata: gitt, system: gitt ? SYSTEM[Math.floor(r() * SYSTEM.length)] : null, gitt: gitt ? plussDagar("2025-01-01", Math.round(r() * 600)) : null };
  if (gitt) reskontro[b.kunde_id] = reskontroFor(b, sim, r);
}

const ssb = existsSync(new URL("../data/ssb-konkurs.json", import.meta.url)) ? JSON.parse(readFileSync(new URL("../data/ssb-konkurs.json", import.meta.url), "utf8")) : null;

const ut = {
  les_meg: [
    "TILLEGGSDATA til kundedata.json (BM Bergen). Per dato: 2026-10-01. Beløp i kNOK.",
    "Bankdata er SYNTETISK, men av ein type banken har i eigne system, og konsistent med kundedata.json.",
    "SSB-data er EKTE, henta frå SSB sitt opne API (sjå ssb_konkurs.kjelde).",
    "Namn på betalarar og debitorar er konstruerte og fiktive.",
    "Kategorien anna_inn i kontantstraum er overføringar frå andre kontoar og innskot. For kundar med svært høg utnytting av kassekreditten er dette ei forenkling.",
    "Generert av scripts/lag-tilleggsdata.ts. Same kundedata gir same resultat.",
  ],
  kjelder: {
    konto_historikk: "Bankens kjernesystem: dagleg saldo på driftskonto og trekk på kassakreditt, 365 dagar",
    kontantstraum: "Bankens transaksjonsdata, kategorisert etter mottakar/betalar (lønn, Skatteetaten, utleigar, straumleverandør osv.), 104 veker",
    betalarar: "Bankens transaksjonsdata: kven innbetalingane kjem frå",
    lan: "Bankens lånesystem: nedbetalingsplan, terminar og forfall",
    sikkerheiter: "Bankens sikkerheitsregister: pant og kausjonar",
    avviste_betalingar: "Bankens betalingssystem: betalingar avvist på grunn av manglande dekning",
    samtykke: "Bankens samtykkeregister: kva kunden har gitt tilgang til",
    reskontro: "Kundens rekneskapssystem via API (berre med samtykke): kundefordringar, forfalt leverandørgjeld og restansar",
    ssb_konkurs: "SSB, opne data: konkursar etter næring og region",
  },
  konto_historikk: { fra: DAGLIG_FRA, til: PER_DATO, kundar: kontoHistorikk },
  kontantstraum: { kategoriar_inn: INN, kategoriar_ut: UT, kundar: kontantstraum },
  betalarar,
  lan,
  sikkerheiter,
  avviste_betalingar: avvisteBetalingar.sort((a, c) => a.kunde_id.localeCompare(c.kunde_id) || a.dato.localeCompare(c.dato)),
  samtykke,
  reskontro,
  ssb_konkurs: ssb,
};

writeFileSync(new URL("../data/tilleggsdata.json", import.meta.url), JSON.stringify(ut) + "\n");
console.log(`Skrev data/tilleggsdata.json for ${data.Bedrifter.length} kundar (${Object.keys(reskontro).length} med samtykke til rekneskapsdata)`);
