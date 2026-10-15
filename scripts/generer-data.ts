// Genererer den syntetiske porteføljen til data/portefolje.json.
// Kjør: npm run data
//
// Alle bedrifter er fiktive. Organisasjonsnumrene har bevisst feil kontrollsiffer,
// slik at de aldri kan tilhøre en ekte virksomhet.

import { writeFileSync } from "node:fs";
import type { Bransje, Debitor, Faktura, FasteKostnader, Kunde, Lan, Notat, Portefolje, Restanser, Samtykkeniva } from "../src/lib/types.ts";
import { DAGENS_DATO, leggTilDager, mandagI, tilDato, ukedag } from "../src/lib/dato.ts";
import { kjentePoster } from "../src/lib/kalender.ts";
import { SESONG } from "../src/lib/sesong.ts";

const RADGIVER = "Kari Nilsen";

// Deterministisk tilfeldighet (mulberry32)
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fiktivtOrgnr(r: () => number): string {
  const vekter = [3, 2, 7, 6, 5, 4, 3, 2];
  const siffer = [9, ...Array.from({ length: 7 }, () => Math.floor(r() * 10))];
  const sum = siffer.reduce((s, d, i) => s + d * vekter[i], 0);
  const rest = sum % 11;
  const gyldig = rest === 0 ? 0 : 11 - rest;
  // Velg et kontrollsiffer som garantert er ugyldig
  const ugyldig = gyldig === 10 ? 0 : (gyldig + 1) % 10;
  const s = [...siffer, ugyldig].join("");
  return `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6)}`;
}

interface Profil {
  id: string;
  navn: string;
  bransje: Bransje;
  naceKode: string;
  adresse: string;
  ansatte: number;
  etablert: number;
  dagligLeder: string;
  samtykke: Samtykkeniva;
  risikoklasse: Kunde["risikoklasse"];
  energiintensiv?: boolean;
  sesongprofil?: number[];
  sesongbedrift?: boolean;

  innPerUke: number; // normalnivå før sesong
  netMargin: number; // overskudd som andel av innbetalinger i et normalår (før trend)
  trend: number; // endring i innbetalinger siste 12 uker, f.eks. -0.25
  stoy: number; // variasjon dag til dag
  sluttSaldo: number;

  kassekredittRamme: number;
  lan: Lan[];
  sikkerheter: number;
  faste: Omit<FasteKostnader, "stromPerMnd"> & { stromPerMnd?: number };
  avvisteBetalinger30d: number;
  debitorer: Debitor[];
  fakturaer?: Omit<Faktura, "id">[];
  forfaltLeverandorgjeld?: number;
  restanser?: Restanser;
  eier?: Kunde["eier"];
  tredjepart?: Kunde["tredjepart"];
  sisteKontakt: string;
  notater: Notat[];
  regnskapIFjor: Kunde["regnskapIFjor"];
}

const STROMPRIS_KWH = 1.45; // ca. NO5, oktober 2026 (inkl. nettleie-tillegg holdes utenfor)

const lan = (navn: string, saldo: number, rentesats: number, avdragPerMnd: number, forfalteTerminer = 0): Lan => ({
  navn,
  saldo,
  rentesats,
  avdragPerMnd,
  forfalteTerminer,
  forfaltBelop: forfalteTerminer * Math.round(avdragPerMnd + (saldo * rentesats) / 12),
});

const PROFILER: Profil[] = [
  {
    id: "fjellsiden-bygg",
    navn: "Fjellsiden Bygg AS",
    bransje: "Bygg og anlegg",
    naceKode: "41.200 Oppføring av bygninger",
    adresse: "Ibsens gate 18, 5052 Bergen",
    ansatte: 24,
    etablert: 2009,
    dagligLeder: "Geir Haukeland",
    samtykke: 2,
    risikoklasse: "D",
    innPerUke: 780_000,
    netMargin: 0.03,
    trend: -0.25,
    stoy: 0.9,
    sluttSaldo: -1_450_000,
    kassekredittRamme: 2_500_000,
    lan: [lan("Maskinlån", 3_200_000, 0.074, 60_000, 1)],
    sikkerheter: 4_100_000,
    faste: { bruttoLonnPerMnd: 1_250_000, husleiePerMnd: 95_000, stromKwhPerMnd: 9_000, mvaAndelAvOmsetning: 0.09 },
    avvisteBetalinger30d: 3,
    debitorer: [
      { navn: "Vestland Eiendom AS", andelAvInnbetalinger: 0.38, snittDagerForsinkelse: 41 },
      { navn: "Bergen kommune", andelAvInnbetalinger: 0.22, snittDagerForsinkelse: 2 },
      { navn: "Sandviken Boligbyggelag", andelAvInnbetalinger: 0.15, snittDagerForsinkelse: 9 },
      { navn: "Privatkunder (samlet)", andelAvInnbetalinger: 0.25, snittDagerForsinkelse: 6 },
    ],
    fakturaer: [
      { debitor: "Vestland Eiendom AS", belop: 640_000, fakturadato: "2026-08-03", forfall: "2026-08-31" },
      { debitor: "Vestland Eiendom AS", belop: 585_000, fakturadato: "2026-09-01", forfall: "2026-09-30" },
      { debitor: "Vestland Eiendom AS", belop: 410_000, fakturadato: "2026-10-01", forfall: "2026-10-31" },
      { debitor: "Bergen kommune", belop: 455_000, fakturadato: "2026-09-28", forfall: "2026-10-28" },
      { debitor: "Bergen kommune", belop: 380_000, fakturadato: "2026-09-14", forfall: "2026-10-14" },
      { debitor: "Sandviken Boligbyggelag", belop: 265_000, fakturadato: "2026-09-09", forfall: "2026-10-09" },
      { debitor: "Sandviken Boligbyggelag", belop: 230_000, fakturadato: "2026-09-21", forfall: "2026-10-21" },
      { debitor: "Privatkunder (samlet)", belop: 310_000, fakturadato: "2026-10-05", forfall: "2026-10-19" },
    ],
    forfaltLeverandorgjeld: 690_000,
    restanser: { mva: 0, forskuddstrekkOgAga: 0 },
    eier: { navn: "Geir Haukeland", kausjon: 1_000_000, boliglanIBanken: true },
    tredjepart: { betalingsanmerkninger: 0, inkassosaker: 1 },
    sisteKontakt: "2026-08-27",
    notater: [
      {
        dato: "2026-06-12",
        forfatter: RADGIVER,
        tekst:
          "Årsgjennomgang. God ordrereserve, men Kronstad-prosjektet for Vestland Eiendom står for nesten 40 % av omsetningen. Kassekreditten ble økt fra 2,0 til 2,5 MNOK før sommeren. Avtalt ny kontakt etter ferien.",
      },
      {
        dato: "2026-08-27",
        forfatter: RADGIVER,
        tekst:
          "Kort telefon. Geir nevnte at Vestland Eiendom har utsatt oppstart av fase 2 til våren og at de «drar ut» betalingene på fase 1. Han er ikke bekymret ennå, men har stoppet nyansettelser. Vurderer å si opp to lærlinger.",
      },
    ],
    regnskapIFjor: { driftsinntekter: 43_800_000, aarsresultat: 1_240_000, egenkapital: 5_900_000 },
  },
  {
    id: "sandviken-ror",
    navn: "Sandviken Rør AS",
    bransje: "Bygg og anlegg",
    naceKode: "43.220 VVS-arbeid",
    adresse: "Sandviksveien 41, 5035 Bergen",
    ansatte: 9,
    etablert: 2014,
    dagligLeder: "Tor Erik Mjelde",
    samtykke: 1,
    risikoklasse: "C",
    innPerUke: 210_000,
    netMargin: 0.025,
    trend: -0.12,
    stoy: 0.7,
    sluttSaldo: -310_000,
    kassekredittRamme: 750_000,
    lan: [lan("Billån (varebiler)", 640_000, 0.069, 14_000)],
    sikkerheter: 900_000,
    faste: { bruttoLonnPerMnd: 430_000, husleiePerMnd: 28_000, stromKwhPerMnd: 1_500, mvaAndelAvOmsetning: 0.1 },
    avvisteBetalinger30d: 1,
    debitorer: [
      { navn: "Fjellsiden Bygg AS", andelAvInnbetalinger: 0.46, snittDagerForsinkelse: 24, internKunde: "fjellsiden-bygg" },
      { navn: "Privatkunder (samlet)", andelAvInnbetalinger: 0.32, snittDagerForsinkelse: 5 },
      { navn: "Øvrige næringskunder", andelAvInnbetalinger: 0.22, snittDagerForsinkelse: 8 },
    ],
    sisteKontakt: "2026-04-22",
    notater: [
      { dato: "2026-04-22", forfatter: RADGIVER, tekst: "Fornyet billån for to nye varebiler. Stabil drift, mye arbeid som underleverandør for Fjellsiden Bygg." },
    ],
    regnskapIFjor: { driftsinntekter: 11_400_000, aarsresultat: 610_000, egenkapital: 2_100_000 },
  },
  {
    id: "laksevag-elektro",
    navn: "Laksevåg Elektro AS",
    bransje: "Bygg og anlegg",
    naceKode: "43.210 Elektrisk installasjonsarbeid",
    adresse: "Damsgårdsveien 120, 5160 Laksevåg",
    ansatte: 14,
    etablert: 2001,
    dagligLeder: "Hilde Brekke",
    samtykke: 2,
    risikoklasse: "B",
    innPerUke: 330_000,
    netMargin: 0.06,
    trend: -0.04,
    stoy: 0.6,
    sluttSaldo: 420_000,
    kassekredittRamme: 1_000_000,
    lan: [],
    sikkerheter: 1_500_000,
    faste: { bruttoLonnPerMnd: 640_000, husleiePerMnd: 45_000, stromKwhPerMnd: 2_200, mvaAndelAvOmsetning: 0.1 },
    avvisteBetalinger30d: 0,
    debitorer: [
      { navn: "Fjellsiden Bygg AS", andelAvInnbetalinger: 0.29, snittDagerForsinkelse: 19, internKunde: "fjellsiden-bygg" },
      { navn: "BKK-entrepriser", andelAvInnbetalinger: 0.31, snittDagerForsinkelse: 3 },
      { navn: "Privatkunder (samlet)", andelAvInnbetalinger: 0.4, snittDagerForsinkelse: 4 },
    ],
    fakturaer: [
      { debitor: "Fjellsiden Bygg AS", belop: 285_000, fakturadato: "2026-09-10", forfall: "2026-10-10" },
      { debitor: "Fjellsiden Bygg AS", belop: 190_000, fakturadato: "2026-10-01", forfall: "2026-10-31" },
      { debitor: "BKK-entrepriser", belop: 320_000, fakturadato: "2026-10-02", forfall: "2026-11-01" },
      { debitor: "Privatkunder (samlet)", belop: 140_000, fakturadato: "2026-10-08", forfall: "2026-10-22" },
    ],
    forfaltLeverandorgjeld: 40_000,
    restanser: { mva: 0, forskuddstrekkOgAga: 0 },
    sisteKontakt: "2026-09-03",
    notater: [{ dato: "2026-09-03", forfatter: RADGIVER, tekst: "Møte om grønt lån til elbiler. Solid økonomi. Hilde er opptatt av å spre kundeporteføljen." }],
    regnskapIFjor: { driftsinntekter: 17_900_000, aarsresultat: 1_480_000, egenkapital: 4_300_000 },
  },
  {
    id: "asane-interior",
    navn: "Åsane Interiør AS",
    bransje: "Varehandel",
    naceKode: "47.591 Butikkhandel med møbler",
    adresse: "Åsane senter 22, 5116 Ulset",
    ansatte: 11,
    etablert: 2016,
    dagligLeder: "Marit Sletten",
    samtykke: 2,
    risikoklasse: "E",
    innPerUke: 260_000,
    netMargin: -0.01,
    trend: -0.24,
    stoy: 0.5,
    sluttSaldo: -1_060_000,
    kassekredittRamme: 1_100_000,
    lan: [lan("Driftskreditt (nedbetaling)", 900_000, 0.082, 25_000, 2)],
    sikkerheter: 600_000,
    faste: { bruttoLonnPerMnd: 420_000, husleiePerMnd: 140_000, stromKwhPerMnd: 3_500, mvaAndelAvOmsetning: 0.12 },
    avvisteBetalinger30d: 6,
    debitorer: [{ navn: "Butikksalg (kort)", andelAvInnbetalinger: 1, snittDagerForsinkelse: 1 }],
    fakturaer: [],
    forfaltLeverandorgjeld: 820_000,
    restanser: { mva: 187_000, forskuddstrekkOgAga: 0 },
    tredjepart: { betalingsanmerkninger: 1, inkassosaker: 2 },
    sisteKontakt: "2026-09-29",
    notater: [
      { dato: "2026-09-29", forfatter: RADGIVER, tekst: "Marit ringte om forfalt termin. Lavt salg etter at nabobutikken åpnet. Ba om avdragsfrihet; sa vi ville se på det. Leverandør truer med inkasso." },
    ],
    regnskapIFjor: { driftsinntekter: 13_100_000, aarsresultat: -380_000, egenkapital: 520_000 },
  },
  {
    id: "bryggen-bistro",
    navn: "Bryggen Bistro AS",
    bransje: "Servering",
    naceKode: "56.101 Drift av restauranter og kafeer",
    adresse: "Bryggen 9, 5003 Bergen",
    ansatte: 17,
    etablert: 2018,
    dagligLeder: "Jonas Ytrehus",
    samtykke: 1,
    risikoklasse: "D",
    energiintensiv: true,
    innPerUke: 290_000,
    netMargin: 0.02,
    trend: -0.08,
    stoy: 0.35,
    sluttSaldo: -120_000,
    kassekredittRamme: 600_000,
    lan: [lan("Inventarlån", 1_100_000, 0.079, 22_000)],
    sikkerheter: 700_000,
    faste: { bruttoLonnPerMnd: 610_000, husleiePerMnd: 120_000, stromKwhPerMnd: 18_000, mvaAndelAvOmsetning: 0.11 },
    avvisteBetalinger30d: 2,
    debitorer: [{ navn: "Kortsalg", andelAvInnbetalinger: 0.85, snittDagerForsinkelse: 1 }, { navn: "Firmaarrangement", andelAvInnbetalinger: 0.15, snittDagerForsinkelse: 12 }],
    sisteKontakt: "2026-05-30",
    notater: [{ dato: "2026-05-30", forfatter: RADGIVER, tekst: "Sesongstart. Mange cruiseturister ventet. Strømkostnadene bekymrer, vurderer nye kjøleanlegg." }],
    regnskapIFjor: { driftsinntekter: 14_600_000, aarsresultat: 290_000, egenkapital: 1_100_000 },
  },
  {
    id: "solheimsviken-verksted",
    navn: "Solheimsviken Verksted AS",
    bransje: "Industri",
    naceKode: "33.150 Reparasjon av skip og båter",
    adresse: "Solheimsgaten 15, 5058 Bergen",
    ansatte: 31,
    etablert: 1994,
    dagligLeder: "Arne Fosse",
    samtykke: 2,
    risikoklasse: "C",
    energiintensiv: true,
    innPerUke: 900_000,
    netMargin: 0.03,
    trend: -0.1,
    stoy: 1.0,
    sluttSaldo: -350_000,
    kassekredittRamme: 3_000_000,
    lan: [lan("Byggelån verkstedhall", 8_400_000, 0.068, 110_000)],
    sikkerheter: 11_000_000,
    faste: { bruttoLonnPerMnd: 1_700_000, husleiePerMnd: 0, stromKwhPerMnd: 40_000, mvaAndelAvOmsetning: 0.08 },
    avvisteBetalinger30d: 0,
    debitorer: [
      { navn: "Fjord Line-avtalen", andelAvInnbetalinger: 0.35, snittDagerForsinkelse: 15 },
      { navn: "Havbruk Vest", andelAvInnbetalinger: 0.3, snittDagerForsinkelse: 21 },
      { navn: "Øvrige", andelAvInnbetalinger: 0.35, snittDagerForsinkelse: 7 },
    ],
    fakturaer: [
      { debitor: "Havbruk Vest", belop: 1_150_000, fakturadato: "2026-08-14", forfall: "2026-09-13" },
      { debitor: "Fjord Line-avtalen", belop: 980_000, fakturadato: "2026-09-25", forfall: "2026-10-25" },
      { debitor: "Øvrige", belop: 760_000, fakturadato: "2026-10-05", forfall: "2026-11-04" },
    ],
    forfaltLeverandorgjeld: 210_000,
    restanser: { mva: 0, forskuddstrekkOgAga: 342_000 },
    sisteKontakt: "2026-08-14",
    notater: [{ dato: "2026-08-14", forfatter: RADGIVER, tekst: "Gjennomgang av energikostnader. Arne vurderer varmepumpe og solceller på hallen, interessert i grønt lån og Enova-støtte." }],
    regnskapIFjor: { driftsinntekter: 49_200_000, aarsresultat: 2_050_000, egenkapital: 14_800_000 },
  },
  {
    id: "bergenhus-transport",
    navn: "Bergenhus Transport AS",
    bransje: "Transport",
    naceKode: "49.410 Godstransport på vei",
    adresse: "Kokstadvegen 30, 5257 Kokstad",
    ansatte: 19,
    etablert: 2007,
    dagligLeder: "Rune Vik",
    samtykke: 1,
    risikoklasse: "C",
    innPerUke: 480_000,
    netMargin: 0.015,
    trend: -0.06,
    stoy: 0.5,
    sluttSaldo: -380_000,
    kassekredittRamme: 1_500_000,
    lan: [lan("Leasing lastebiler", 5_600_000, 0.071, 95_000)],
    sikkerheter: 6_000_000,
    faste: { bruttoLonnPerMnd: 900_000, husleiePerMnd: 60_000, stromKwhPerMnd: 2_000, mvaAndelAvOmsetning: 0.1 },
    avvisteBetalinger30d: 1,
    debitorer: [
      { navn: "Dagligvaregrossist", andelAvInnbetalinger: 0.55, snittDagerForsinkelse: 4 },
      { navn: "Øvrige", andelAvInnbetalinger: 0.45, snittDagerForsinkelse: 9 },
    ],
    sisteKontakt: "2026-06-30",
    notater: [{ dato: "2026-06-30", forfatter: RADGIVER, tekst: "Diskuterte overgang til elektriske lastebiler. Dieselprisen spiser marginen." }],
    regnskapIFjor: { driftsinntekter: 24_700_000, aarsresultat: 410_000, egenkapital: 3_200_000 },
  },
  {
    id: "fyllingsdalen-bakeri",
    navn: "Fyllingsdalen Bakeri AS",
    bransje: "Næringsmiddel",
    naceKode: "10.710 Produksjon av brød og ferske konditorvarer",
    adresse: "Folke Bernadottes vei 50, 5147 Fyllingsdalen",
    ansatte: 12,
    etablert: 1988,
    dagligLeder: "Liv Johannessen",
    samtykke: 1,
    risikoklasse: "B",
    energiintensiv: true,
    innPerUke: 210_000,
    netMargin: 0.05,
    trend: 0.02,
    stoy: 0.3,
    sluttSaldo: 160_000,
    kassekredittRamme: 500_000,
    lan: [lan("Ovnslån", 700_000, 0.069, 15_000)],
    sikkerheter: 800_000,
    faste: { bruttoLonnPerMnd: 450_000, husleiePerMnd: 55_000, stromKwhPerMnd: 22_000, mvaAndelAvOmsetning: 0.08 },
    avvisteBetalinger30d: 0,
    debitorer: [{ navn: "Butikksalg", andelAvInnbetalinger: 0.6, snittDagerForsinkelse: 1 }, { navn: "Dagligvarekjede", andelAvInnbetalinger: 0.4, snittDagerForsinkelse: 3 }],
    sisteKontakt: "2026-09-18",
    notater: [{ dato: "2026-09-18", forfatter: RADGIVER, tekst: "Fornøyd kunde. Spurte om fastpris på strøm." }],
    regnskapIFjor: { driftsinntekter: 11_200_000, aarsresultat: 520_000, egenkapital: 2_600_000 },
  },
  {
    id: "ytrebygda-hagesenter",
    navn: "Ytrebygda Hagesenter AS",
    bransje: "Varehandel",
    naceKode: "47.761 Butikkhandel med blomster og planter",
    adresse: "Sandslimarka 251, 5254 Sandsli",
    ansatte: 8,
    etablert: 2003,
    dagligLeder: "Bjørn Totland",
    samtykke: 2,
    risikoklasse: "B",
    sesongbedrift: true,
    sesongprofil: [0.3, 0.35, 0.8, 1.9, 2.4, 1.8, 1.1, 0.9, 0.8, 0.6, 0.5, 0.8],
    innPerUke: 190_000,
    netMargin: 0.05,
    trend: 0,
    stoy: 0.3,
    sluttSaldo: -150_000,
    kassekredittRamme: 900_000,
    lan: [],
    sikkerheter: 1_200_000,
    faste: { bruttoLonnPerMnd: 260_000, husleiePerMnd: 48_000, stromKwhPerMnd: 6_000, mvaAndelAvOmsetning: 0.1 },
    avvisteBetalinger30d: 0,
    debitorer: [{ navn: "Butikksalg (kort)", andelAvInnbetalinger: 1, snittDagerForsinkelse: 1 }],
    fakturaer: [],
    forfaltLeverandorgjeld: 0,
    restanser: { mva: 0, forskuddstrekkOgAga: 0 },
    sisteKontakt: "2026-03-10",
    notater: [{ dato: "2026-03-10", forfatter: RADGIVER, tekst: "Sesongforberedelser. Bruker kassekreditten aktivt om vinteren, betaler ned i mai–juni. Normalt mønster." }],
    regnskapIFjor: { driftsinntekter: 9_800_000, aarsresultat: 640_000, egenkapital: 3_100_000 },
  },
  {
    id: "kronstad-it",
    navn: "Kronstad IT-Consult AS",
    bransje: "IT og rådgivning",
    naceKode: "62.020 Konsulentvirksomhet tilknyttet informasjonsteknologi",
    adresse: "Kanalveien 10, 5068 Bergen",
    ansatte: 16,
    etablert: 2012,
    dagligLeder: "Sofie Lund",
    samtykke: 2,
    risikoklasse: "A",
    innPerUke: 520_000,
    netMargin: 0.1,
    trend: 0.03,
    stoy: 0.6,
    sluttSaldo: 2_300_000,
    kassekredittRamme: 1_000_000,
    lan: [],
    sikkerheter: 0,
    faste: { bruttoLonnPerMnd: 1_350_000, husleiePerMnd: 85_000, stromKwhPerMnd: 1_200, mvaAndelAvOmsetning: 0.16 },
    avvisteBetalinger30d: 0,
    debitorer: [
      { navn: "Offentlig etat (rammeavtale)", andelAvInnbetalinger: 0.62, snittDagerForsinkelse: 3 },
      { navn: "Øvrige", andelAvInnbetalinger: 0.38, snittDagerForsinkelse: 6 },
    ],
    fakturaer: [
      { debitor: "Offentlig etat (rammeavtale)", belop: 1_310_000, fakturadato: "2026-10-01", forfall: "2026-10-31" },
      { debitor: "Øvrige", belop: 640_000, fakturadato: "2026-10-01", forfall: "2026-10-21" },
    ],
    forfaltLeverandorgjeld: 0,
    restanser: { mva: 0, forskuddstrekkOgAga: 0 },
    sisteKontakt: "2026-09-25",
    notater: [{ dato: "2026-09-25", forfatter: RADGIVER, tekst: "Rammeavtalen fornyet til 2028. Solid kunde, høy kundekonsentrasjon er eneste risiko." }],
    regnskapIFjor: { driftsinntekter: 27_100_000, aarsresultat: 3_400_000, egenkapital: 8_800_000 },
  },
  {
    id: "fana-tannklinikk",
    navn: "Fana Tannklinikk AS",
    bransje: "Helse",
    naceKode: "86.230 Tannhelsetjenester",
    adresse: "Nesttunbrekka 99, 5221 Nesttun",
    ansatte: 7,
    etablert: 2011,
    dagligLeder: "Ingrid Aase",
    samtykke: 1,
    risikoklasse: "A",
    innPerUke: 190_000,
    netMargin: 0.12,
    trend: 0.01,
    stoy: 0.3,
    sluttSaldo: 1_150_000,
    kassekredittRamme: 300_000,
    lan: [lan("Utstyrslån", 900_000, 0.065, 18_000)],
    sikkerheter: 1_000_000,
    faste: { bruttoLonnPerMnd: 420_000, husleiePerMnd: 52_000, stromKwhPerMnd: 1_800, mvaAndelAvOmsetning: 0 },
    avvisteBetalinger30d: 0,
    debitorer: [{ navn: "Pasienter", andelAvInnbetalinger: 0.85, snittDagerForsinkelse: 2 }, { navn: "HELFO", andelAvInnbetalinger: 0.15, snittDagerForsinkelse: 0 }],
    sisteKontakt: "2026-08-20",
    notater: [{ dato: "2026-08-20", forfatter: RADGIVER, tekst: "Vurderer å kjøpe nabolokalet. Sterk likviditet." }],
    regnskapIFjor: { driftsinntekter: 9_900_000, aarsresultat: 1_150_000, egenkapital: 3_700_000 },
  },
  {
    id: "minde-eiendomsservice",
    navn: "Minde Eiendomsservice AS",
    bransje: "Eiendomsdrift",
    naceKode: "81.100 Kombinerte tjenester tilknyttet eiendomsdrift",
    adresse: "Fjøsangerveien 65, 5054 Bergen",
    ansatte: 10,
    etablert: 2015,
    dagligLeder: "Kristoffer Moe",
    samtykke: 1,
    risikoklasse: "B",
    innPerUke: 175_000,
    netMargin: 0.06,
    trend: 0,
    stoy: 0.4,
    sluttSaldo: 380_000,
    kassekredittRamme: 400_000,
    lan: [lan("Billån", 450_000, 0.07, 9_000)],
    sikkerheter: 500_000,
    faste: { bruttoLonnPerMnd: 440_000, husleiePerMnd: 22_000, stromKwhPerMnd: 900, mvaAndelAvOmsetning: 0.12 },
    avvisteBetalinger30d: 0,
    debitorer: [{ navn: "Borettslag (samlet)", andelAvInnbetalinger: 0.7, snittDagerForsinkelse: 6 }, { navn: "Næringsgårder", andelAvInnbetalinger: 0.3, snittDagerForsinkelse: 10 }],
    sisteKontakt: "2026-07-01",
    notater: [{ dato: "2026-07-01", forfatter: RADGIVER, tekst: "Rutineoppfølging. Ingen behov nå." }],
    regnskapIFjor: { driftsinntekter: 8_600_000, aarsresultat: 470_000, egenkapital: 1_900_000 },
  },
  {
    id: "paradis-frisor",
    navn: "Paradis Frisør AS",
    bransje: "Personlig tjenesteyting",
    naceKode: "96.021 Frisering og annen skjønnhetspleie",
    adresse: "Paradisleitet 2, 5231 Paradis",
    ansatte: 4,
    etablert: 2019,
    dagligLeder: "Amira Hassan",
    samtykke: 1,
    risikoklasse: "C",
    innPerUke: 62_000,
    netMargin: 0.02,
    trend: -0.07,
    stoy: 0.35,
    sluttSaldo: -45_000,
    kassekredittRamme: 150_000,
    lan: [lan("Etableringslån", 260_000, 0.081, 6_000)],
    sikkerheter: 50_000,
    faste: { bruttoLonnPerMnd: 160_000, husleiePerMnd: 24_000, stromKwhPerMnd: 1_400, mvaAndelAvOmsetning: 0.15 },
    avvisteBetalinger30d: 1,
    debitorer: [{ navn: "Kortsalg", andelAvInnbetalinger: 1, snittDagerForsinkelse: 1 }],
    sisteKontakt: "2026-02-18",
    notater: [{ dato: "2026-02-18", forfatter: "Ole Brun", tekst: "Kunde overført fra Ole Brun ved omorganisering. Ikke møtt ny rådgiver ennå." }],
    regnskapIFjor: { driftsinntekter: 3_100_000, aarsresultat: 95_000, egenkapital: 210_000 },
  },
  {
    id: "nordnes-sjomat",
    navn: "Nordnes Sjømat AS",
    bransje: "Varehandel",
    naceKode: "46.381 Engroshandel med fisk og skalldyr",
    adresse: "Nordnesbakken 4, 5005 Bergen",
    ansatte: 13,
    etablert: 2010,
    dagligLeder: "Even Rasmussen",
    samtykke: 2,
    risikoklasse: "C",
    innPerUke: 640_000,
    netMargin: 0.02,
    trend: -0.05,
    stoy: 0.7,
    sluttSaldo: -520_000,
    kassekredittRamme: 2_000_000,
    lan: [lan("Kjølelager", 2_300_000, 0.07, 35_000)],
    sikkerheter: 2_600_000,
    faste: { bruttoLonnPerMnd: 610_000, husleiePerMnd: 70_000, stromKwhPerMnd: 14_000, mvaAndelAvOmsetning: 0.03 },
    avvisteBetalinger30d: 0,
    debitorer: [
      { navn: "Eksportkunde (Polen)", andelAvInnbetalinger: 0.4, snittDagerForsinkelse: 18 },
      { navn: "Restauranter Bergen", andelAvInnbetalinger: 0.35, snittDagerForsinkelse: 11, internKunde: "bryggen-bistro" },
      { navn: "Fiskebutikker", andelAvInnbetalinger: 0.25, snittDagerForsinkelse: 7 },
    ],
    fakturaer: [
      { debitor: "Eksportkunde (Polen)", belop: 890_000, fakturadato: "2026-09-08", forfall: "2026-10-08" },
      { debitor: "Restauranter Bergen", belop: 420_000, fakturadato: "2026-09-30", forfall: "2026-10-14" },
      { debitor: "Fiskebutikker", belop: 260_000, fakturadato: "2026-10-06", forfall: "2026-10-20" },
    ],
    forfaltLeverandorgjeld: 150_000,
    restanser: { mva: 0, forskuddstrekkOgAga: 0 },
    sisteKontakt: "2026-09-08",
    notater: [{ dato: "2026-09-08", forfatter: RADGIVER, tekst: "Valutarisiko på eksport diskutert. Even vurderer valutasikring." }],
    regnskapIFjor: { driftsinntekter: 33_500_000, aarsresultat: 720_000, egenkapital: 3_900_000 },
  },
];

function lagKunde(p: Profil, indeks: number): Kunde {
  const r = rng(1000 + indeks * 7919);
  const sesong = p.sesongprofil ?? SESONG[p.bransje];
  const start = leggTilDager(mandagI(DAGENS_DATO), -52 * 7);
  const slutt = DAGENS_DATO; // eksklusiv
  const trendStart = leggTilDager(DAGENS_DATO, -84);

  const faste: FasteKostnader = {
    ...p.faste,
    stromPerMnd: p.faste.stromPerMnd ?? Math.round(p.faste.stromKwhPerMnd * STROMPRIS_KWH),
  };
  const kunde = { lan: p.lan, faste } as Kunde;
  const estimertInnPerMnd = p.innPerUke * 4.33;
  const poster = kjentePoster(kunde, start, slutt, { estimertInnPerMnd });
  const posterPerDag = new Map<string, number>();
  for (const post of poster) posterPerDag.set(post.dato, (posterPerDag.get(post.dato) ?? 0) + post.belop);

  // Variable kostnader kalibreres slik at bedriften går med netMargin i et normalår
  const fastePerUke = poster.reduce((s, x) => s + x.belop, 0) / 52;
  const snittSesong = sesong.reduce((s, x) => s + x, 0) / 12;
  const innNormalUke = p.innPerUke * snittSesong;
  const variabelAndel = Math.max(0.05, 1 - fastePerUke / innNormalUke - p.netMargin);

  const dager: { dato: string; inn: number; utVar: number; utFast: number }[] = [];
  for (let iso = start; iso < slutt; iso = leggTilDager(iso, 1)) {
    const mnd = tilDato(iso).getUTCMonth();
    const hverdag = ukedag(iso) < 5;
    let trendFaktor = 1;
    if (iso >= trendStart) {
      const fremdrift = (tilDato(iso).getTime() - tilDato(trendStart).getTime()) / (84 * 86_400_000);
      trendFaktor = 1 + p.trend * fremdrift;
    }
    const stoy = () => Math.max(0, 1 + (r() - 0.5) * 2 * p.stoy);
    const nivaa = (p.innPerUke / 5) * sesong[mnd];
    const inn = hverdag ? nivaa * trendFaktor * stoy() : 0;
    // Variable kostnader er «klebrige»: de faller bare halvparten så mye som innbetalingene
    const utVar = hverdag ? nivaa * variabelAndel * (1 + (trendFaktor - 1) * 0.5) * stoy() : 0;
    dager.push({ dato: iso, inn, utVar, utFast: posterPerDag.get(iso) ?? 0 });
  }

  // Saldo: kumulativ sum, forskjøvet slik at siste dag treffer sluttSaldo
  let lop = 0;
  const raa = dager.map((d) => (lop += d.inn - d.utVar - d.utFast));
  const forskyvning = p.sluttSaldo - raa[raa.length - 1];
  const dagligSaldo = dager
    .map((d, i) => ({ dato: d.dato, saldo: Math.round(raa[i] + forskyvning) }))
    .slice(-90);

  const historikk = [];
  for (let u = 0; u < 52; u++) {
    const fra = leggTilDager(start, u * 7);
    const uke = dager.slice(u * 7, u * 7 + 7);
    historikk.push({
      fra,
      inn: Math.round(uke.reduce((s, d) => s + d.inn, 0)),
      utVariabel: Math.round(uke.reduce((s, d) => s + d.utVar, 0)),
      utFaste: Math.round(uke.reduce((s, d) => s + d.utFast, 0)),
    });
  }

  const harRegnskapsdata = p.samtykke >= 2;
  return {
    id: p.id,
    navn: p.navn,
    orgnr: fiktivtOrgnr(r),
    bransje: p.bransje,
    naceKode: p.naceKode,
    adresse: p.adresse,
    ansatte: p.ansatte,
    etablert: p.etablert,
    dagligLeder: p.dagligLeder,
    radgiver: RADGIVER,
    samtykke: p.samtykke,
    risikoklasse: p.risikoklasse,
    energiintensiv: p.energiintensiv ?? false,
    sesongbedrift: p.sesongbedrift ?? false,
    sesongprofil: sesong,
    kassekredittRamme: p.kassekredittRamme,
    kassekredittRente: 0.089,
    lan: p.lan,
    sikkerheter: p.sikkerheter,
    faste,
    historikk,
    dagligSaldo,
    avvisteBetalinger30d: p.avvisteBetalinger30d,
    debitorer: p.debitorer,
    fakturaer: harRegnskapsdata ? (p.fakturaer ?? []).map((f, i) => ({ ...f, id: `${p.id}-f${i + 1}` })) : undefined,
    forfaltLeverandorgjeld: harRegnskapsdata ? (p.forfaltLeverandorgjeld ?? 0) : undefined,
    restanser: harRegnskapsdata ? (p.restanser ?? { mva: 0, forskuddstrekkOgAga: 0 }) : undefined,
    eier: p.samtykke >= 3 ? p.eier : undefined,
    tredjepart: p.tredjepart ?? { betalingsanmerkninger: 0, inkassosaker: 0 },
    sisteKontakt: p.sisteKontakt,
    notater: p.notater,
    regnskapIFjor: p.regnskapIFjor,
  };
}

const portefolje: Portefolje = {
  generert: new Date().toISOString(),
  dagensDato: DAGENS_DATO,
  radgiver: RADGIVER,
  kunder: PROFILER.map(lagKunde),
};

writeFileSync(new URL("../data/portefolje.json", import.meta.url), JSON.stringify(portefolje, null, 1));
console.log(`Skrev ${portefolje.kunder.length} kunder til data/portefolje.json`);
