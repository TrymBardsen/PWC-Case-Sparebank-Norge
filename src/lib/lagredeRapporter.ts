import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { kontroller, RapportSchema, type Katalogkilde } from "./rapport";
import { langDato } from "./dato";

// Ferdig forberedte møterapporter for demoen (data/rapporter/<kundeId>.json), så rapporten vises uten
// å vente på Claude. En lagret rapport brukes bare når den fortsatt stemmer med dagens kildekatalog:
// skjemaet må passe, alle sitater fra katalogen må stå ordrett, og alle tall må ha kilde. Ellers
// genereres rapporten som vanlig (katalogen endrer seg med datoen, se README om demodato).
export function hentLagretRapport(kundeId: string, katalog: Katalogkilde[]): { tekst: string; laget: string } | null {
  if (!/^[A-Za-z0-9-]{1,20}$/.test(kundeId)) return null;
  const fil = join(process.cwd(), "data", "rapporter", `${kundeId}.json`);
  if (!existsSync(fil)) return null;
  let raa: { laget?: unknown; rapport?: unknown };
  try {
    raa = JSON.parse(readFileSync(fil, "utf8"));
  } catch {
    console.warn(`${fil} er ikke gyldig JSON og brukes ikke.`);
    return null;
  }
  const tolket = RapportSchema.safeParse(raa.rapport);
  if (!tolket.success || tolket.data.kundeId !== kundeId || typeof raa.laget !== "string") {
    console.warn(`${fil} følger ikke rapportskjemaet og brukes ikke.`);
    return null;
  }
  const k = kontroller(tolket.data, katalog, {});
  const avvist = k.sitater.filter((s) => s.status === "ikke funnet" || s.status === "ukjent kilde");
  if (avvist.length || k.tallUtenKilde.length) {
    console.info(`Lagret rapport for ${kundeId} stemmer ikke med dagens kildekatalog (${avvist.length} sitater, ${k.tallUtenKilde.length} tall). Genereres på nytt.`);
    return null;
  }
  return { tekst: JSON.stringify(tolket.data), laget: /^\d{4}-\d{2}-\d{2}$/.test(raa.laget) ? langDato(raa.laget) : raa.laget };
}
