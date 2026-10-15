import "server-only";

// Ekte, åpne makrodata. Faller tilbake til sist kjente verdi hvis API-et er nede.

export interface Makro {
  styringsrente: number; // prosent
  styringsrenteDato: string;
  stromNO5: number; // kr/kWh, snitt i dag
  stromDato: string;
  live: { rente: boolean; strom: boolean };
}

const RESERVE: Makro = {
  styringsrente: 4.5,
  styringsrenteDato: "2026-10-14",
  stromNO5: 1.45,
  stromDato: "2026-10-15",
  live: { rente: false, strom: false },
};

async function hentRente(): Promise<{ verdi: number; dato: string } | null> {
  try {
    const res = await fetch("https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R?format=sdmx-json&lastNObservations=1&locale=no", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const serie = Object.values(json.data.dataSets[0].series)[0] as { observations: Record<string, string[]> };
    const verdi = Number(Object.values(serie.observations)[0][0]);
    const dato = json.data.structure.dimensions.observation[0].values[0].id as string;
    return Number.isFinite(verdi) ? { verdi, dato } : null;
  } catch {
    return null;
  }
}

async function hentStrom(): Promise<{ verdi: number; dato: string } | null> {
  const iDag = new Date().toISOString().slice(0, 10);
  const [aar, mnd, dag] = iDag.split("-");
  try {
    const res = await fetch(`https://www.hvakosterstrommen.no/api/v1/prices/${aar}/${mnd}-${dag}_NO5.json`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const timer = (await res.json()) as { NOK_per_kWh: number }[];
    if (!timer.length) return null;
    return { verdi: timer.reduce((s, t) => s + t.NOK_per_kWh, 0) / timer.length, dato: iDag };
  } catch {
    return null;
  }
}

export async function hentMakro(): Promise<Makro> {
  const [rente, strom] = await Promise.all([hentRente(), hentStrom()]);
  return {
    styringsrente: rente?.verdi ?? RESERVE.styringsrente,
    styringsrenteDato: rente?.dato ?? RESERVE.styringsrenteDato,
    stromNO5: strom?.verdi ?? RESERVE.stromNO5,
    stromDato: strom?.dato ?? RESERVE.stromDato,
    live: { rente: rente !== null, strom: strom !== null },
  };
}
