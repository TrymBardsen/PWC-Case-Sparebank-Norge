// Appens kundemodell. Bygges av src/lib/kundedata.ts fra data/kundedata.json og
// data/tilleggsdata.json. Alle beløp i NOK (kildedataene er i kNOK og regnes om).

export type Samtykkeniva = 1 | 2 | 3;
// 1: offentlige data + bankens egne data
// 2: + regnskapssystem (reskontro, leverandørgjeld)
// 3: + eierens privatøkonomi (finnes ikke i datagrunnlaget)

export interface Lan {
  navn: string;
  saldo: number;
  rentesats: number; // årlig, f.eks. 0.072
  avdragPerMnd: number;
  forfalteTerminer: number;
  forfaltBelop: number;
  sluttdato?: string;
  sluttbetaling?: number; // restverdi som forfaller på sluttdato
}

export interface FasteKostnader {
  // Estimert fra transaksjonshistorikken (gjentakende betalinger)
  bruttoLonnPerMnd: number; // utbetales netto (70 %) den 20.
  husleiePerMnd: number; // betales den 1.
  stromPerMnd: number; // betales den 15.
  stromKwhPerMnd?: number; // ukjent i datagrunnlaget
  mvaAndelAvOmsetning: number; // netto MVA som andel av innbetalinger
  // Beløp per kalendermåned (0–11) lest fra samme måned i fjor, justert for utviklingen siden.
  // Fanger opp sesongbemanning, feriepenger, halv skatt og vinterstrøm uten antakelser.
  perMnd?: { lonn: number[]; skattetrekkOgAga: number[]; strom: number[] };
}

export interface Uke {
  fra: string; // ISO-dato, mandag
  inn: number; // innbetalinger fra kunder og kortoppgjør
  utVariabel: number; // leverandører, pensjon og øvrig
  utFaste: number; // lønn, skatt, MVA, husleie, strøm, lån
}

export interface DagSaldo {
  dato: string;
  saldo: number; // driftskonto minus trekk på kassekreditt
}

export interface Debitor {
  navn: string;
  andelAvInnbetalinger: number; // 0–1
  snittDagerForsinkelse?: number; // kjent bare med reskontro (samtykke)
  type?: string;
  internKunde?: string; // id hvis debitoren også er kunde i porteføljen
}

export interface Faktura {
  id: string;
  debitor: string;
  belop: number;
  fakturadato: string;
  forfall: string;
}

export interface Notat {
  dato: string;
  forfatter: string;
  tekst: string;
}

export interface Tekstkilde {
  id: string;
  type: "notat" | "epost" | "nyhet" | "kunngjoring" | "bank";
  dato: string;
  avsender: string;
  tittel?: string;
  tekst: string;
}

export interface Energitiltak {
  navn: string;
  beskrivelse: string;
  investering: number;
  enovaStotte: number;
  besparelseAndel: number;
  annenBesparelsePerAar?: number;
  co2TonnPerAar?: number;
}

export interface Restanser {
  mva: number;
  forskuddstrekkOgAga: number;
  skatt: number; // restskatt (åpne data)
}

export interface Bransjerisiko {
  niva: "høy" | "middels" | "lav" | "ukjent";
  forklaring: string;
}

export interface Motpart {
  navn: string;
  andel: number;
  hendelse: string;
  dato: string;
}

export interface Kunde {
  id: string;
  navn: string;
  orgnr: string;
  bransje: string;
  naceKode: string;
  adresse: string;
  ansatte: number;
  etablert: number;
  kundeSiden: number;
  segment: string;
  eierstruktur: string;
  dagligLeder: string;
  radgiver: string;
  samtykke: Samtykkeniva;
  regnskapssystem?: string;
  risikoklasse: string;
  energiintensiv: boolean;
  sesongbedrift: boolean;
  sesongprofil: number[]; // 12 månedlige faktorer fra egen historikk, snitt ≈ 1
  bransjerisiko: Bransjerisiko;

  kassekredittRamme: number;
  kassekredittRente: number;
  kassekredittTrekk: number[]; // daglig trekk, samme datoer som dagligSaldo
  lan: Lan[];
  sikkerheter: number;

  faste: FasteKostnader;
  historikk: Uke[]; // 104 uker bakover
  dagligSaldo: DagSaldo[]; // 365 dager bakover
  avvisteBetalinger90d: number;
  debitorer: Debitor[];

  // Krever samtykke nivå 2
  fakturaer?: Faktura[];
  forfaltLeverandorgjeld?: number;

  // Åpne data (restskatt) og hendelser
  restanser?: Restanser;
  tredjepart: { betalingsanmerkninger: number; inkassosaker: number };
  motpart?: Motpart; // stor motpart med betalingsanmerkning
  sensitiv?: string; // situasjon der banken skal være varsom med kontakt

  // Krever samtykke nivå 3 (finnes ikke i datagrunnlaget)
  eier?: { navn: string; kausjon: number; boliglanIBanken: boolean };

  sisteKontakt: string | null;
  sisteKontaktType: string | null;
  notater: Notat[];
  regnskapIFjor: { driftsinntekter: number; driftsresultat: number; egenkapitalAndel: number; omsetning: { aar: number; belop: number }[] };

  tekster: Tekstkilde[];

  // Grønn omstilling (ingen data i grunnlaget)
  energitiltak?: Energitiltak;
  klimakrav?: string;
}

export interface Portefolje {
  dagensDato: string;
  radgiver: string;
  kunder: Kunde[];
}
