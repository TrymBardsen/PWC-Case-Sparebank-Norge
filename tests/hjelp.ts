// Felles testdata: samme syntetiske datagrunnlag som appen bruker.
import { readFileSync } from "node:fs";
import { byggPortefolje, type Kundedata, type Tilleggsdata } from "../src/lib/kundedata.ts";
import type { Kunde } from "../src/lib/types.ts";

const les = (fil: string) => JSON.parse(readFileSync(new URL(`../data/${fil}`, import.meta.url), "utf8"));

export const kundedata = les("kundedata.json") as Kundedata;
export const tilleggsdata = les("tilleggsdata.json") as Tilleggsdata;
export const portefolje = byggPortefolje(kundedata, tilleggsdata);

export function kunde(id: string): Kunde {
  const k = portefolje.kunder.find((x) => x.id === id);
  if (!k) throw new Error(`Fant ikke ${id}`);
  return k;
}

// Kopi som kan endres i en test uten å påvirke andre tester
export function kopi(id: string, endring: (k: Kunde) => void = () => {}): Kunde {
  const k = structuredClone(kunde(id));
  endring(k);
  return k;
}
