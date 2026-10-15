// Grønn omstilling koblet til likviditet: finner kunder der et energitiltak både er
// nødvendig (klimakrav, høye strømkostnader) og gjennomførbart (tåler det likviditetsmessig).

import type { Kunde } from "./types.ts";
import { GRONN_LOPETID_AAR, GRONN_RENTE, lagPrognose, NETTLEIE_OG_AVGIFT, STANDARDVALG, type PrognoseValg } from "./prognose.ts";
import { regelbasertAnalyse } from "./tekst.ts";

// Forenklet utslippsfaktor for norsk strømmiks (lokasjonsbasert). Lav, fordi norsk strøm er nesten fornybar.
export const CO2_KG_PER_KWH = 0.017;

export interface GronnVurdering {
  navn: string;
  beskrivelse: string;
  investering: number;
  enovaStotte: number;
  lanebelop: number;
  kwhSpartPerAar: number;
  besparelsePerAar: number; // med dagens strømpris pluss nettleie og avgifter
  terminPerAar: number; // grønt lån, år 1
  nettoPerAar: number; // besparelse minus termin, år 1
  tilbakebetalingAar: number; // egen kostnad (etter Enova) / besparelse
  co2TonnPerAar: number;
  likviditetEffekt: number; // endring i margin mot insolvensgrensen de neste 13 ukene
  sannsynlighetFor: number;
  sannsynlighetEtter: number;
  nodvendig: string[]; // hvorfor kunden bør gjøre det
  gjennomforbar: boolean;
  kumulativ: { aar: number; netto: number }[]; // 10 år, akkumulert kontanteffekt
}

export function vurderGronn(kunde: Kunde, stromprisKwh: number, scenario: PrognoseValg = STANDARDVALG): GronnVurdering | null {
  const e = kunde.energitiltak;
  if (!e) return null;
  const lanebelop = e.investering - e.enovaStotte;
  const kwhSpartPerAar = kunde.faste.stromKwhPerMnd * 12 * e.besparelseAndel;
  const besparelsePerAar = kwhSpartPerAar * (stromprisKwh * scenario.stromFaktor + NETTLEIE_OG_AVGIFT) + (e.annenBesparelsePerAar ?? 0);
  const terminPerAar = lanebelop / GRONN_LOPETID_AAR + lanebelop * GRONN_RENTE;

  // Akkumulert kontanteffekt de første 10 årene: besparelse minus avdrag og renter på det grønne lånet
  const kumulativ: { aar: number; netto: number }[] = [];
  let sum = 0;
  for (let aar = 1; aar <= 10; aar++) {
    const restgjeld = lanebelop * (1 - (aar - 1) / GRONN_LOPETID_AAR);
    sum += besparelsePerAar - lanebelop / GRONN_LOPETID_AAR - restgjeld * GRONN_RENTE;
    kumulativ.push({ aar, netto: Math.round(sum) });
  }

  const uten = lagPrognose(kunde, scenario);
  const med = lagPrognose(kunde, { ...scenario, energitiltak: true });

  const nodvendig: string[] = [];
  if (kunde.klimakrav) nodvendig.push(kunde.klimakrav);
  const strom = kunde.faste.stromPerMnd * 12;
  if (kunde.energiintensiv) nodvendig.push(`Energiintensiv drift: strøm koster ca. ${Math.round(strom / 1000)} 000 kr i året og gjør kunden sårbar for prisøkninger.`);
  if (regelbasertAnalyse(kunde).signaler.some((s) => s.kategori === "grønn interesse")) nodvendig.push("Kunden har selv vist interesse for energitiltak.");

  return {
    navn: e.navn,
    beskrivelse: e.beskrivelse,
    investering: e.investering,
    enovaStotte: e.enovaStotte,
    lanebelop,
    kwhSpartPerAar: Math.round(kwhSpartPerAar),
    besparelsePerAar: Math.round(besparelsePerAar),
    terminPerAar: Math.round(terminPerAar),
    nettoPerAar: Math.round(besparelsePerAar - terminPerAar),
    tilbakebetalingAar: besparelsePerAar > 0 ? lanebelop / besparelsePerAar : Infinity,
    co2TonnPerAar: e.co2TonnPerAar ?? (kwhSpartPerAar * CO2_KG_PER_KWH) / 1000,
    likviditetEffekt: med.margin - uten.margin,
    sannsynlighetFor: uten.sannsynlighetInsolvens,
    sannsynlighetEtter: med.sannsynlighetInsolvens,
    nodvendig,
    // Gjennomførbart når kunden holder seg over insolvensgrensen og tiltaket er likviditetsnøytralt eller betaler seg raskt
    gjennomforbar: med.margin >= 0 && (besparelsePerAar >= terminPerAar || lanebelop / besparelsePerAar <= 8),
    kumulativ,
  };
}
