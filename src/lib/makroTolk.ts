// Tolking og rimelighetskontroll av åpne makrodata (Norges Bank og hvakosterstrommen.no).
// Ugyldige eller urimelige verdier gir null, så kalleren bruker en tydelig merket reserveverdi.

import { z } from "zod";

const NorgesBankSvar = z.object({
  data: z.object({
    dataSets: z.array(z.object({ series: z.record(z.string(), z.object({ observations: z.record(z.string(), z.array(z.string())) })) })).min(1),
    structure: z.object({ dimensions: z.object({ observation: z.array(z.object({ values: z.array(z.object({ id: z.string() })).min(1) })).min(1) }) }),
  }),
});

export function tolkRente(json: unknown): { verdi: number; dato: string } | null {
  const tolket = NorgesBankSvar.safeParse(json);
  if (!tolket.success) return null;
  const serie = Object.values(tolket.data.data.dataSets[0].series)[0];
  const observasjon = serie ? Object.values(serie.observations)[0] : undefined;
  const verdi = Number(observasjon?.[0]);
  const dato = tolket.data.data.structure.dimensions.observation[0].values.at(-1)?.id ?? "";
  // Styringsrenten i prosent; alt utenfor -1 til 20 er tolkningsfeil
  if (!Number.isFinite(verdi) || verdi < -1 || verdi > 20 || !/^\d{4}-\d{2}(-\d{2})?$/.test(dato)) return null;
  return { verdi, dato };
}

const StromSvar = z.array(z.object({ NOK_per_kWh: z.number() })).min(1);

export function tolkStrom(json: unknown, dato: string): { verdi: number; dato: string } | null {
  const tolket = StromSvar.safeParse(json);
  if (!tolket.success) return null;
  const verdi = tolket.data.reduce((s, t) => s + t.NOK_per_kWh, 0) / tolket.data.length;
  // Spotpris i kr/kWh; negative timepriser forekommer, men et døgnsnitt utenfor -1 til 20 er feil
  if (!Number.isFinite(verdi) || verdi < -1 || verdi > 20) return null;
  return { verdi, dato };
}
