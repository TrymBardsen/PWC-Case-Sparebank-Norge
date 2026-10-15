// Kjører tekstanalysen med Claude for alle kunder og lagrer til data/tekstsignaler.json.
// Krever ANTHROPIC_API_KEY. Kjør: npm run tekstsignaler

import { analyserMedClaude, lagre } from "../src/lib/tekstAi.ts";
import { portefolje as data } from "./last-portefolje.ts";
for (const kunde of data.kunder) {
  if (!kunde.tekster.length && !kunde.notater.length) continue;
  const analyse = await analyserMedClaude(kunde);
  lagre(kunde.id, analyse);
  console.log(`${kunde.navn}: ${analyse.signaler.length} signaler, ${analyse.forkastet} forkastet`);
}
