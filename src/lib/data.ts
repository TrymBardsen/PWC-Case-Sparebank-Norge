import "server-only";
import raw from "../../data/portefolje.json";
import type { Kunde, Portefolje } from "./types";
import { vurderPortefolje } from "./score";
import { regelbasertAnalyse } from "./tekst";
import { lesLagrede } from "./tekstAi";

export const portefolje = raw as unknown as Portefolje;

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
