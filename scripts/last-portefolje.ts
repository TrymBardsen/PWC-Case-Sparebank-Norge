// Felles lasting av datagrunnlaget for skriptene (samme som appen bruker).
import { readFileSync } from "node:fs";
import { byggPortefolje, type Kundedata, type Tilleggsdata } from "../src/lib/kundedata.ts";

const les = (fil: string) => JSON.parse(readFileSync(new URL(`../data/${fil}`, import.meta.url), "utf8"));
export const portefolje = byggPortefolje(les("kundedata.json") as Kundedata, les("tilleggsdata.json") as Tilleggsdata);
