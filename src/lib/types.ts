// Datamodell for den syntetiske porteføljen. Alle beløp i NOK.

export type Samtykkeniva = 1 | 2 | 3;
// 1: offentlige data + bankens egne data
// 2: + regnskapssystem (reskontro, leverandørgjeld, skatt/MVA-restanser)
// 3: + eierens privatøkonomi

export type Bransje =
  | "Bygg og anlegg"
  | "Servering"
  | "Varehandel"
  | "Transport"
  | "Industri"
  | "Helse"
  | "IT og rådgivning"
  | "Eiendomsdrift"
  | "Personlig tjenesteyting"
  | "Næringsmiddel";

export interface Lan {
  navn: string;
  saldo: number;
  rentesats: number; // årlig, f.eks. 0.072
  avdragPerMnd: number;
  forfalteTerminer: number;
  forfaltBelop: number;
}

export interface FasteKostnader {
  bruttoLonnPerMnd: number; // utbetales netto (70 %) den 20.
  husleiePerMnd: number; // betales den 1.
  stromPerMnd: number; // kWh-avhengig, betales den 15.
  stromKwhPerMnd: number;
  mvaAndelAvOmsetning: number; // netto MVA som andel av innbetalinger
}

export interface Uke {
  fra: string; // ISO-dato, mandag
  inn: number;
  utVariabel: number;
  utFaste: number;
}

export interface DagSaldo {
  dato: string;
  saldo: number;
}

export interface Debitor {
  navn: string;
  andelAvInnbetalinger: number; // 0–1
  snittDagerForsinkelse: number;
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

export interface Restanser {
  mva: number;
  forskuddstrekkOgAga: number;
}

export interface Kunde {
  id: string;
  navn: string;
  orgnr: string; // fiktivt, bevisst ugyldig kontrollsiffer
  bransje: Bransje;
  naceKode: string;
  adresse: string;
  ansatte: number;
  etablert: number;
  dagligLeder: string;
  radgiver: string;
  samtykke: Samtykkeniva;
  risikoklasse: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  energiintensiv: boolean;
  sesongbedrift: boolean;
  sesongprofil: number[]; // 12 månedlige faktorer, snitt ≈ 1

  kassekredittRamme: number;
  kassekredittRente: number;
  lan: Lan[];
  sikkerheter: number;

  faste: FasteKostnader;
  historikk: Uke[]; // 52 uker bakover
  dagligSaldo: DagSaldo[]; // 90 dager bakover
  avvisteBetalinger30d: number;
  debitorer: Debitor[];

  // Krever samtykke nivå 2
  fakturaer?: Faktura[];
  forfaltLeverandorgjeld?: number;
  restanser?: Restanser;

  // Krever samtykke nivå 3
  eier?: { navn: string; kausjon: number; boliglanIBanken: boolean };

  // Simulert tredjepartsdata
  tredjepart: { betalingsanmerkninger: number; inkassosaker: number };

  sisteKontakt: string;
  notater: Notat[];
  regnskapIFjor: { driftsinntekter: number; aarsresultat: number; egenkapital: number };
}

export interface Portefolje {
  generert: string;
  dagensDato: string;
  radgiver: string;
  kunder: Kunde[];
}
