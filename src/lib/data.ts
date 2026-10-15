import "server-only";
import kundedata from "../../data/kundedata.json";
import tilleggsdata from "../../data/tilleggsdata.json";
import type { Kunde } from "./types";
import { byggPortefolje, type Kundedata, type Tilleggsdata } from "./kundedata";
import { vurderPortefolje } from "./score";
import { regelbasertAnalyse } from "./tekst";
import { lesLagrede } from "./tekstAi";

// Eneste datagrunnlag: data/kundedata.json + data/tilleggsdata.json
export const portefolje = byggPortefolje(kundedata as unknown as Kundedata, tilleggsdata as unknown as Tilleggsdata);

let cache: { endret: number; resultat: ReturnType<typeof vurderPortefolje> } | null = null;

// Tekstsignaler: lagret Claude-analyse hvis den finnes, ellers regelbasert
export function hentVurderinger() {
  const { endret, analyser } = lesLagrede();
  if (!cache || cache.endret !== endret) {
    cache = { endret, resultat: vurderPortefolje(portefolje.kunder, (k) => analyser[k.id] ?? regelbasertAnalyse(k)) };
  }
  return cache.resultat;
}

export function hentKunde(id: string): Kunde | undefined {
  return portefolje.kunder.find((k) => k.id === id);
}
