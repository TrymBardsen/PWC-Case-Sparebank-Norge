// 13-ukers likviditetsprognose. Bevisst regelbasert: hver krone i prognosen kan
// spores tilbake til en historisk trend, en kjent utbetaling eller en faktura.
//
// Metode:
//  1. Sesong: kundens egen profil fra de to siste årene (transaksjonshistorikken).
//  2. Normal drift: samme uke i fjor, justert med veksten siste 12 uker mot samme uker året før.
//     (Med kortere historikk: vektet, sesongjustert nivå med dempet trend.)
//  4. Kjente forfall på eksakt dato. MVA beregnes av faktisk omsetning i terminen.
//  5. Reskontro (med samtykke) erstatter historikken de første fire ukene.
//  6. Usikkerhet fra kundens egen uke-til-uke-variasjon, og sannsynligheten for
//     å passere insolvensgrensen (kassekreditten brukt opp) per dag.

import type { Kunde } from "./types.ts";
import { DAGENS_DATO, dagerMellom, leggTilDager, tilDato, ukedag } from "./dato.ts";
import { kjentePoster, type Kategori } from "./kalender.ts";

export interface PrognoseValg {
  // Scenarioer
  renteTillegg: number; // 0.01 = +1 prosentpoeng
  storsteKundeForsinkelse: number; // dager
  stromFaktor: number; // 1.5 = +50 %
  omsetningsfall: number; // 0.2 = -20 %
  // Tiltak
  factoring: boolean;
  rammeokning: number;
  avdragsfrihet: boolean;
  kkTilLan: number; // del av kassekreditten som gjøres om til nedbetalingslån
  mvaAvtale: boolean; // betalingsavtale med Skatteetaten: MVA deles på tre måneder
  innfordring: boolean; // aktiv oppfølging av forfalte fakturaer
  innfordringDager: number; // dager til forfalte fakturaer er innbetalt
  factoringForskudd: number; // andel av fakturabeløpet som utbetales straks
  mvaAvtaleMnd: number; // antall måneder MVA-forfallet deles på
  energitiltak: boolean; // grønn investering finansiert med grønt lån og Enova-støtte
  energiBesparelse: number; // andel av strømforbruket som spares (overstyrer kundens anslag når > 0)
  kostnadskutt: number; // 0.1 = -10 % variable kostnader fra uke 3
  kapitaltilskudd: number; // innskudd fra eier
}

export const STANDARDVALG: PrognoseValg = {
  renteTillegg: 0,
  storsteKundeForsinkelse: 0,
  stromFaktor: 1,
  omsetningsfall: 0,
  factoring: false,
  rammeokning: 0,
  avdragsfrihet: false,
  kkTilLan: 0,
  mvaAvtale: false,
  innfordring: false,
  innfordringDager: 7,
  factoringForskudd: 0.8,
  mvaAvtaleMnd: 3,
  energitiltak: false,
  energiBesparelse: 0,
  kostnadskutt: 0,
  kapitaltilskudd: 0,
};

export const SCENARIO_FELT: (keyof PrognoseValg)[] = ["renteTillegg", "storsteKundeForsinkelse", "stromFaktor", "omsetningsfall"];

export interface UkePost {
  navn: string;
  belop: number; // positivt = inn, negativt = ut
  kategori: Kategori | "salg" | "faktura" | "variabel" | "restanse" | "kkrente" | "factoring" | "tiltak";
  dato?: string;
}

export interface PrognoseUke {
  nr: number;
  fra: string;
  inn: number;
  ut: number;
  sluttSaldo: number;
  minSaldo: number;
  lav: number; // usikkerhetsbånd
  hoy: number;
  sannsynlighet: number; // for å være under insolvensgrensen en dag i uken
  poster: UkePost[];
}

export interface PrognoseDag {
  dato: string;
  saldo: number;
  bredde: number; // halv bredde på 80 %-intervallet
  sannsynlighet: number;
}

export interface Metode {
  sesong: "egen historikk" | "flat";
  nivaInnPerUke: number;
  nivaUtPerUke: number;
  sesongnaiv: boolean; // samme uke i fjor × vekst
  vekstInn: number; // siste 12 uker mot samme uker i fjor
  vekstUt: number;
  trendPerUke: number; // relativ, f.eks. -0.02
  sigmaPerUke: number;
  mvaFraFaktisk: boolean;
}

export interface Prognose {
  startSaldo: number;
  ramme: number; // insolvensgrensen er -ramme
  uker: PrognoseUke[];
  dager: PrognoseDag[];
  tomKasseDato: string | null;
  ukerTilTomKasse: number | null;
  lavesteSaldo: number;
  lavesteDato: string;
  margin: number; // laveste saldo minus insolvensgrensen (negativ = insolvent)
  sannsynlighetInsolvens: number; // høyeste daglige sannsynlighet i perioden
  dagerUnderGrensen: number;
  brukerReskontro: boolean;
  innEndring: number;
  storsteDebitor: string;
  storsteDebitorAndel: number;
  metode: Metode;
}

const UKER = 13;
const BLANDING_DAGER = 28;
const ANDEL_KONTANT_NAR_RESKONTRO = 0.2;
const HALVERINGSTID_UKER = 3;
const TRENDDEMPING = 0.8;
const Z80 = 1.2816;
export const GRONN_RENTE = 0.059; // grønt lån, rabattert rente
export const GRONN_LOPETID_AAR = 15; // tilpasset levetiden til tiltaket
export const NETTLEIE_OG_AVGIFT = 0.45; // kr/kWh i tillegg til spotpris (forenklet)

// Standard normalfordeling (Abramowitz–Stegun)
function phi(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

const mndAv = (iso: string) => tilDato(iso).getUTCMonth();

// Sesongprofil: egen historikk eldre enn 13 uker (så fallet nå ikke forveksles med sesong)
function lagSesong(kunde: Kunde, felt: "inn" | "utVariabel" = "inn"): { profil: number[]; egen: boolean } {
  const grunnprofil = felt === "inn" ? kunde.sesongprofil : new Array(12).fill(1);
  const eldre = kunde.historikk.slice(0, -13);
  const perMnd = new Map<number, number[]>();
  for (const u of eldre) {
    const m = mndAv(leggTilDager(u.fra, 3));
    perMnd.set(m, [...(perMnd.get(m) ?? []), u[felt]]);
  }
  const mnder = [...perMnd.keys()].filter((m) => perMnd.get(m)!.length >= 3);
  if (mnder.length < 6) return { profil: grunnprofil, egen: false };
  const snitt = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const egenSnitt = snitt(mnder.map((m) => snitt(perMnd.get(m)!)));
  if (egenSnitt <= 0) return { profil: grunnprofil, egen: false };
  // Hver serie (innbetalinger og variable kostnader) får sin egen profil fra historikken
  const profil = grunnprofil.map((b, m) => (mnder.includes(m) ? Math.max(0.2, snitt(perMnd.get(m)!) / egenSnitt) : b));
  return { profil, egen: true };
}

// Vektet nivå og dempet trend for én serie, sesongjustert
function nivaOgTrend(kunde: Kunde, sesong: number[], felt: "inn" | "utVariabel") {
  const uker = kunde.historikk.slice(-12);
  const verdier = uker.map((u) => u[felt] / sesong[mndAv(leggTilDager(u.fra, 3))]);
  const n = verdier.length;
  const vekter = verdier.map((_, i) => Math.pow(0.5, (n - 1 - i) / HALVERINGSTID_UKER));
  const niva = verdier.reduce((s, v, i) => s + v * vekter[i], 0) / vekter.reduce((s, w) => s + w, 0);
  const xSnitt = (n - 1) / 2;
  const ySnitt = verdier.reduce((s, v) => s + v, 0) / n;
  const stigning =
    verdier.reduce((s, v, i) => s + (i - xSnitt) * (v - ySnitt), 0) / verdier.reduce((s, _, i) => s + (i - xSnitt) ** 2, 0);
  const trend = niva > 0 ? Math.max(-0.04, Math.min(0.04, stigning / niva)) : 0;
  return { niva, trend };
}

// Kumulert effekt av dempet trend etter h uker
function trendFaktor(trend: number, h: number): number {
  let kum = 0;
  for (let j = 1; j <= Math.floor(h); j++) kum += Math.pow(TRENDDEMPING, j);
  kum += (h - Math.floor(h)) * Math.pow(TRENDDEMPING, Math.floor(h) + 1);
  return Math.max(0.3, 1 + trend * kum);
}

// Uke-til-uke-variasjon i netto drift (robust mot nivåskift)
function sigmaPerUke(kunde: Kunde, sesong: number[]): number {
  const netto = kunde.historikk.slice(-26).map((u) => (u.inn - u.utVariabel) / sesong[mndAv(leggTilDager(u.fra, 3))]);
  const diff = netto.slice(1).map((x, i) => x - netto[i]);
  const snitt = diff.reduce((s, x) => s + x, 0) / diff.length;
  const varians = diff.reduce((s, x) => s + (x - snitt) ** 2, 0) / (diff.length - 1);
  return Math.sqrt(varians / 2);
}

export function innEndring(kunde: Kunde): number {
  const h = kunde.historikk;
  const snitt = (uker: Kunde["historikk"]) => uker.reduce((s, u) => s + u.inn / kunde.sesongprofil[mndAv(leggTilDager(u.fra, 3))], 0) / uker.length;
  const for_ = snitt(h.slice(-26, -13));
  return for_ > 0 ? snitt(h.slice(-6)) / for_ - 1 : 0;
}

// Faktiske innbetalinger per måned fra historikken (brukes til MVA)
function lagInnForMaaned(kunde: Kunde) {
  const map = new Map<string, { sum: number; dager: number }>();
  for (const u of kunde.historikk) {
    const d = tilDato(leggTilDager(u.fra, 3));
    const nokkel = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const e = map.get(nokkel) ?? { sum: 0, dager: 0 };
    e.sum += u.inn;
    e.dager += 7;
    map.set(nokkel, e);
  }
  return (aar: number, mnd: number) => {
    const e = map.get(`${aar}-${mnd}`);
    if (!e || e.dager < 14) return undefined;
    const dagerIMnd = new Date(Date.UTC(aar, mnd + 1, 0)).getUTCDate();
    return (e.sum * dagerIMnd) / e.dager;
  };
}

export function lagPrognose(kunde: Kunde, valg: PrognoseValg = STANDARDVALG): Prognose {
  const start = DAGENS_DATO;
  const slutt = leggTilDager(start, UKER * 7);
  const ramme = kunde.kassekredittRamme + valg.rammeokning;
  const startSaldo = kunde.dagligSaldo[kunde.dagligSaldo.length - 1].saldo;

  const { profil: sesong, egen: egenSesong } = lagSesong(kunde);
  const inn = nivaOgTrend(kunde, sesong, "inn");
  const ut = nivaOgTrend(kunde, sesong, "utVariabel");
  const sigma = sigmaPerUke(kunde, sesong);
  const innForMaaned = lagInnForMaaned(kunde);

  const fakturaer = kunde.fakturaer ?? [];
  const brukerReskontro = fakturaer.length > 0;
  const blandingSlutt = brukerReskontro ? leggTilDager(start, BLANDING_DAGER) : start;

  const storste = [...kunde.debitorer].sort((a, b) => b.andelAvInnbetalinger - a.andelAvInnbetalinger)[0];
  const forsinkelseSlutt = leggTilDager(blandingSlutt, valg.storsteKundeForsinkelse);

  const hendelser = new Map<string, UkePost[]>();
  const leggTil = (dato: string, post: UkePost) => {
    if (dato < start || dato >= slutt) return;
    const liste = hendelser.get(dato) ?? [];
    liste.push({ ...post, dato });
    hendelser.set(dato, liste);
  };

  // 1. Normal drift. Med minst 65 uker historikk: samme uke i fjor × vekst (siste 12 uker mot
  //    samme 12 uker året før). Ellers: sesongjustert nivå med dempet trend.
  const h = kunde.historikk;
  const sesongnaiv = h.length >= 65;
  const vekst = (felt: "inn" | "utVariabel") => {
    const naa = h.slice(-12).reduce((a, u) => a + u[felt], 0);
    const fjor = h.slice(-64, -52).reduce((a, u) => a + u[felt], 0);
    return fjor > 0 ? Math.min(2, Math.max(0.5, naa / fjor)) : 1;
  };
  const vekstInn = sesongnaiv ? vekst("inn") : 1;
  // Variable kostnader følger aktiviteten: veksten kan avvike inntil ±25 % fra veksten i innbetalingene
  const vekstUt = sesongnaiv ? Math.min(vekstInn * 1.25, Math.max(vekstInn * 0.75, vekst("utVariabel"))) : 1;
  const ukeIFjor = (iso: string) => {
    const ifjor = leggTilDager(iso, -364);
    return h.find((u) => u.fra <= ifjor && ifjor <= leggTilDager(u.fra, 6));
  };
  for (let iso = start; iso < slutt; iso = leggTilDager(iso, 1)) {
    if (ukedag(iso) >= 5) continue;
    const s = sesong[mndAv(iso)];
    const uke = sesongnaiv ? ukeIFjor(iso) : undefined;
    const hh = dagerMellom(start, iso) / 7;
    let innDag = uke ? (uke.inn * vekstInn) / 5 : (inn.niva * s * trendFaktor(inn.trend, hh)) / 5;
    innDag *= 1 - valg.omsetningsfall;
    if (iso < blandingSlutt) innDag *= ANDEL_KONTANT_NAR_RESKONTRO;
    if (valg.storsteKundeForsinkelse > 0 && iso >= blandingSlutt && iso < forsinkelseSlutt) {
      innDag *= 1 - storste.andelAvInnbetalinger;
    }
    leggTil(iso, { navn: brukerReskontro && iso < blandingSlutt ? "Kontantsalg (anslag)" : "Innbetalinger (normalnivå)", belop: innDag, kategori: "salg" });
    // Løpende factoring: nye fakturaer gir forskudd med en gang i stedet for etter ~30 dager.
    if (valg.factoring && brukerReskontro && iso >= blandingSlutt) {
      if (iso < leggTilDager(blandingSlutt, 30)) leggTil(iso, { navn: "Factoring: forskudd på nye fakturaer", belop: innDag * valg.factoringForskudd, kategori: "factoring" });
      leggTil(iso, { navn: "Factoringgebyr (1,5 %)", belop: -innDag * 0.015, kategori: "factoring" });
    }
    let utDag = uke ? (uke.utVariabel * vekstUt) / 5 : (ut.niva * s * trendFaktor(ut.trend, hh)) / 5;
    utDag *= 1 - valg.omsetningsfall * 0.5;
    if (valg.kostnadskutt > 0 && iso >= leggTilDager(start, 14)) utDag *= 1 - valg.kostnadskutt;
    leggTil(iso, { navn: "Varekjøp og variable kostnader", belop: -utDag, kategori: "variabel" });
  }

  // 2. Utestående fakturaer fra reskontro
  let factoringUtbetalt = 0;
  for (const f of fakturaer) {
    const debitor = kunde.debitorer.find((d) => d.navn === f.debitor);
    const forsinkelse = debitor?.snittDagerForsinkelse ?? 7;
    let forventet = leggTilDager(f.forfall, forsinkelse);
    if (forventet < leggTilDager(start, 3)) forventet = leggTilDager(start, 3 + (dagerMellom(f.forfall, start) > 30 ? 14 : 0));
    if (valg.innfordring) {
      // Purring, inkassovarsel og dialog: forfalte fakturaer inn innen valgt antall dager, nye nær forfall
      const raskere = f.forfall < start ? leggTilDager(start, valg.innfordringDager) : leggTilDager(f.forfall, Math.min(forsinkelse, 5));
      if (raskere < forventet) forventet = raskere;
    }
    if (debitor && debitor.navn === storste.navn) forventet = leggTilDager(forventet, valg.storsteKundeForsinkelse);
    if (valg.factoring) {
      factoringUtbetalt += f.belop * valg.factoringForskudd;
      leggTil(forventet, { navn: `Restbetaling factoring: ${f.debitor}`, belop: f.belop * (1 - valg.factoringForskudd) - f.belop * 0.015, kategori: "factoring" });
    } else {
      leggTil(forventet, { navn: `Faktura: ${f.debitor}`, belop: f.belop, kategori: "faktura" });
    }
  }
  if (factoringUtbetalt > 0) {
    leggTil(leggTilDager(start, 3), { navn: `Factoring: forskudd på fakturaer (${Math.round(valg.factoringForskudd * 100)} %)`, belop: factoringUtbetalt, kategori: "factoring" });
  }

  // 3. Kjente utbetalinger
  const mvaTilAvtale = (dato: string, belop: number, navn: string) => {
    const n = Math.max(1, Math.round(valg.mvaAvtaleMnd));
    for (let i = 0; i < n; i++) {
      leggTil(leggTilDager(dato, i * 30), { navn: `${navn} (betalingsavtale ${i + 1}/${n})`, belop: -(belop / n) * (1 + 0.005 * n), kategori: "mva" });
    }
  };
  for (const p of kjentePoster(kunde, start, slutt, {
    estimertInnPerMnd: inn.niva * 4.33 * (1 - valg.omsetningsfall),
    innForMaaned,
    stromFaktor: valg.stromFaktor,
    renteTillegg: valg.renteTillegg,
    utenAvdrag: valg.avdragsfrihet,
  })) {
    if (p.kategori === "mva" && valg.mvaAvtale) mvaTilAvtale(p.dato, p.belop, p.navn);
    else leggTil(p.dato, { navn: p.navn, belop: -p.belop, kategori: p.kategori });
  }

  // 4. Restanser og forfalt gjeld som må gjøres opp
  for (const lan of kunde.lan) {
    if (lan.forfaltBelop > 0) leggTil(leggTilDager(start, 5), { navn: `Forfalte terminer: ${lan.navn}`, belop: -lan.forfaltBelop, kategori: "restanse" });
  }
  if (kunde.restanser) {
    if (kunde.restanser.mva > 0) {
      if (valg.mvaAvtale) mvaTilAvtale(leggTilDager(start, 10), kunde.restanser.mva, "MVA-restanse");
      else leggTil(leggTilDager(start, 10), { navn: "MVA-restanse", belop: -kunde.restanser.mva, kategori: "restanse" });
    }
    if (kunde.restanser.skatt > 0) leggTil(leggTilDager(start, 10), { navn: "Ubetalt restskatt", belop: -kunde.restanser.skatt, kategori: "restanse" });
    // Forskuddstrekk er de ansattes penger og kan ikke inngå i betalingsavtale
    if (kunde.restanser.forskuddstrekkOgAga > 0)
      leggTil(leggTilDager(start, 10), { navn: "Restanse forskuddstrekk/AGA", belop: -kunde.restanser.forskuddstrekkOgAga, kategori: "restanse" });
  }
  if (kunde.forfaltLeverandorgjeld) {
    for (let i = 0; i < 3; i++) {
      leggTil(leggTilDager(start, 4 + i * 7), { navn: "Forfalt leverandørgjeld (nedbetaling)", belop: -kunde.forfaltLeverandorgjeld / 3, kategori: "restanse" });
    }
  }

  // 5. Tiltak som tilfører eller flytter likviditet
  if (valg.kkTilLan > 0) {
    leggTil(leggTilDager(start, 1), { navn: "Kassekreditt omgjort til nedbetalingslån", belop: valg.kkTilLan, kategori: "tiltak" });
    for (let iso = leggTilDager(start, 1); iso < slutt; iso = leggTilDager(iso, 1)) {
      if (tilDato(iso).getUTCDate() === 20) {
        const termin = valg.kkTilLan / 60 + (valg.kkTilLan * (0.075 + valg.renteTillegg)) / 12;
        leggTil(iso, { navn: "Nytt nedbetalingslån (5 år): termin", belop: -termin, kategori: "lan" });
      }
    }
  }
  // Energitiltak: grønt lån dekker investeringen minus Enova-støtten, og banken mellomfinansierer
  // støtten til den utbetales. Likviditetsnøytralt ved oppstart, så besparelse mot lånetermin.
  const energi = kunde.energitiltak;
  if (valg.energitiltak && energi) {
    const lanebelop = energi.investering - energi.enovaStotte;
    const oppstart = leggTilDager(start, 14);
    leggTil(oppstart, { navn: `Investering: ${energi.navn}`, belop: -energi.investering, kategori: "tiltak" });
    leggTil(oppstart, { navn: `Grønt lån (${GRONN_LOPETID_AAR} år)`, belop: lanebelop, kategori: "tiltak" });
    leggTil(oppstart, { navn: "Mellomfinansiering av Enova-støtte", belop: energi.enovaStotte, kategori: "tiltak" });
    const andel = valg.energiBesparelse > 0 ? valg.energiBesparelse : energi.besparelseAndel;
    for (let iso = leggTilDager(start, 15); iso < slutt; iso = leggTilDager(iso, 1)) {
      const dag = tilDato(iso).getUTCDate();
      if (dag === 20) {
        const termin = lanebelop / (GRONN_LOPETID_AAR * 12) + (lanebelop * (GRONN_RENTE + valg.renteTillegg)) / 12;
        leggTil(iso, { navn: "Grønt lån: termin", belop: -termin, kategori: "lan" });
      }
      if (dag === 15 && iso >= leggTilDager(start, 45)) {
        if (andel > 0) {
          const kwh = (kunde.faste.stromKwhPerMnd ?? 0) * andel;
          leggTil(iso, { navn: "Spart strøm (energitiltak)", belop: (kunde.faste.stromPerMnd / (kunde.faste.stromKwhPerMnd || 1)) * valg.stromFaktor * kwh + kwh * NETTLEIE_OG_AVGIFT, kategori: "tiltak" });
        }
        if (energi.annenBesparelsePerAar) leggTil(iso, { navn: "Spart drivstoff og vedlikehold", belop: energi.annenBesparelsePerAar / 12, kategori: "tiltak" });
      }
    }
  }

  if (valg.kapitaltilskudd > 0) {
    leggTil(leggTilDager(start, 14), { navn: "Kapitaltilskudd fra eier", belop: valg.kapitaltilskudd, kategori: "tiltak" });
  }

  // Simuler dag for dag
  const dager: PrognoseDag[] = [];
  const uker: PrognoseUke[] = [];
  let saldo = startSaldo;
  let kkRenteAkkumulert = 0;
  let tomKasseDato: string | null = null;
  let lavesteSaldo = startSaldo;
  let lavesteDato = start;
  let dagerUnderGrensen = 0;
  const renteKk = kunde.kassekredittRente + valg.renteTillegg;

  for (let u = 0; u < UKER; u++) {
    const fra = leggTilDager(start, u * 7);
    const uke: PrognoseUke = { nr: u + 1, fra, inn: 0, ut: 0, sluttSaldo: 0, minSaldo: Infinity, lav: 0, hoy: 0, sannsynlighet: 0, poster: [] };
    for (let d = 0; d < 7; d++) {
      const iso = leggTilDager(fra, d);
      for (const h of hendelser.get(iso) ?? []) {
        saldo += h.belop;
        if (h.belop >= 0) uke.inn += h.belop;
        else uke.ut -= h.belop;
        uke.poster.push(h);
      }
      if (saldo < 0) kkRenteAkkumulert += (-saldo * renteKk) / 365;
      if (tilDato(leggTilDager(iso, 1)).getUTCDate() === 1 && kkRenteAkkumulert > 0) {
        saldo -= kkRenteAkkumulert;
        uke.ut += kkRenteAkkumulert;
        uke.poster.push({ navn: "Renter kassekreditt", belop: -kkRenteAkkumulert, kategori: "kkrente", dato: iso });
        kkRenteAkkumulert = 0;
      }

      // Usikkerhet: vokser med kvadratroten av tiden, mindre de første ukene med reskontro
      const t = u * 7 + d + 1;
      const reduksjon = brukerReskontro && t <= BLANDING_DAGER ? 0.6 : 1;
      const sigmaT = Math.max(1, sigma * Math.sqrt(t / 7) * reduksjon);
      const sannsynlighet = phi((-ramme - saldo) / sigmaT);
      dager.push({ dato: iso, saldo: Math.round(saldo), bredde: Math.round(Z80 * sigmaT), sannsynlighet });

      uke.minSaldo = Math.min(uke.minSaldo, saldo);
      uke.sannsynlighet = Math.max(uke.sannsynlighet, sannsynlighet);
      if (saldo < lavesteSaldo) {
        lavesteSaldo = saldo;
        lavesteDato = iso;
      }
      if (saldo < -ramme) {
        dagerUnderGrensen++;
        tomKasseDato ??= iso;
      }
    }
    uke.sluttSaldo = Math.round(saldo);
    uke.minSaldo = Math.round(uke.minSaldo);
    const siste = dager[dager.length - 1];
    uke.lav = Math.round(uke.minSaldo - siste.bredde);
    uke.hoy = Math.round(uke.sluttSaldo + siste.bredde);
    uker.push(uke);
  }

  return {
    startSaldo,
    ramme,
    uker,
    dager,
    tomKasseDato,
    ukerTilTomKasse: tomKasseDato ? Math.floor(dagerMellom(start, tomKasseDato) / 7) : null,
    lavesteSaldo: Math.round(lavesteSaldo),
    lavesteDato,
    margin: Math.round(lavesteSaldo + ramme),
    sannsynlighetInsolvens: Math.max(...dager.map((d) => d.sannsynlighet)),
    dagerUnderGrensen,
    brukerReskontro,
    innEndring: innEndring(kunde),
    storsteDebitor: storste.navn,
    storsteDebitorAndel: storste.andelAvInnbetalinger,
    metode: {
      sesong: egenSesong ? "egen historikk" : "flat",
      nivaInnPerUke: Math.round(inn.niva),
      nivaUtPerUke: Math.round(ut.niva),
      sesongnaiv,
      vekstInn,
      vekstUt,
      trendPerUke: inn.trend,
      sigmaPerUke: Math.round(sigma),
      mvaFraFaktisk: true,
    },
  };
}

// Samler ukens poster per navn, største først (for visning)
export function oppsummerPoster(poster: UkePost[]): UkePost[] {
  const map = new Map<string, UkePost>();
  for (const p of poster) {
    const eksisterende = map.get(p.navn);
    if (eksisterende) eksisterende.belop += p.belop;
    else map.set(p.navn, { ...p });
  }
  return [...map.values()].sort((a, b) => Math.abs(b.belop) - Math.abs(a.belop));
}
