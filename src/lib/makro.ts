import "server-only";
import { tolkRente, tolkStrom } from "./makroTolk.ts";

// Ekte, åpne makrodata. Hvis API-et er nede eller svarer uventet, brukes en reserveverdi
// som er merket med live: false og ikke skal presenteres som dagens verdi.

export interface Makro {
  styringsrente: number; // prosent
  styringsrenteDato: string;
  stromNO5: number; // kr/kWh, snitt i dag
  stromDato: string;
  live: { rente: boolean; strom: boolean };
}

// Omtrentlige verdier for demo når kildene ikke svarer. Ikke ferske data.
const RESERVE: Makro = {
  styringsrente: 4.5,
  styringsrenteDato: "reserveverdi",
  stromNO5: 1.45,
  stromDato: "reserveverdi",
  live: { rente: false, strom: false },
};

async function hentJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      console.warn(`Makrodata: ${new URL(url).host} svarte HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`Makrodata: ${new URL(url).host} utilgjengelig (${e instanceof Error ? e.name : "ukjent"})`);
    return null;
  }
}

export async function hentMakro(): Promise<Makro> {
  const iDag = new Date().toISOString().slice(0, 10);
  const [aar, mnd, dag] = iDag.split("-");
  const [renteJson, stromJson] = await Promise.all([
    hentJson("https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R?format=sdmx-json&lastNObservations=1&locale=no"),
    hentJson(`https://www.hvakosterstrommen.no/api/v1/prices/${aar}/${mnd}-${dag}_NO5.json`),
  ]);
  const rente = renteJson === null ? null : tolkRente(renteJson);
  const strom = stromJson === null ? null : tolkStrom(stromJson, iDag);
  return {
    styringsrente: rente?.verdi ?? RESERVE.styringsrente,
    styringsrenteDato: rente?.dato ?? RESERVE.styringsrenteDato,
    stromNO5: strom?.verdi ?? RESERVE.stromNO5,
    stromDato: strom?.dato ?? RESERVE.stromDato,
    live: { rente: rente !== null, strom: strom !== null },
  };
}
