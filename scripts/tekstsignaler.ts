// Kjører tekstanalysen med Claude for alle kunder og lagrer til data/tekstsignaler.json.
// Krever ANTHROPIC_API_KEY. Kjør: npm run tekstsignaler

import { readFileSync } from "node:fs";
import type { Portefolje } from "../src/lib/types.ts";
import { analyserMedClaude, lagre } from "../src/lib/tekstAi.ts";

const data: Portefolje = JSON.parse(readFileSync(new URL("../data/portefolje.json", import.meta.url), "utf8"));
for (const kunde of data.kunder) {
  if (!kunde.tekster.length && !kunde.notater.length) continue;
  const analyse = await analyserMedClaude(kunde);
  lagre(kunde.id, analyse);
  console.log(`${kunde.navn}: ${analyse.signaler.length} signaler, ${analyse.forkastet} forkastet`);
}
