import "server-only";
import raw from "../../data/portefolje.json";
import type { Kunde, Portefolje } from "./types";
import { vurderPortefolje } from "./score";

export const portefolje = raw as unknown as Portefolje;

let cache: ReturnType<typeof vurderPortefolje> | null = null;

export function hentVurderinger() {
  cache ??= vurderPortefolje(portefolje.kunder);
  return cache;
}

export function hentKunde(id: string): Kunde | undefined {
  return portefolje.kunder.find((k) => k.id === id);
}
