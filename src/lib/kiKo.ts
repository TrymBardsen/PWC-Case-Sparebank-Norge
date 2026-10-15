import "server-only";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Rapportbroen: i stedet for å kalle Anthropic API legges forespørselen i en kø på disk.
// Claude (i en Claude Code-økt som følger med på mappen) lager svaret og skriver det tilbake.
// For nettsiden ser det ut som et vanlig, asynkront API-kall.

const KO = join(process.cwd(), "data", "ki-ko");

export interface Foresporsel {
  jobbId: string;
  kundeId: string;
  opprettet: string;
  oppgave: "moterapport";
  prompt: string;
}

const gyldigId = (id: string) => /^[A-Za-z0-9-]+$/.test(id);

export function leggIKo(kundeId: string, prompt: string): Foresporsel {
  mkdirSync(KO, { recursive: true });
  const jobbId = `${kundeId}-${Date.now()}`;
  const f: Foresporsel = { jobbId, kundeId, opprettet: new Date().toISOString(), oppgave: "moterapport", prompt };
  writeFileSync(join(KO, `${jobbId}.foresporsel.json`), JSON.stringify(f, null, 1));
  // Prompten også som ren tekst, så den er lett å lese for den som svarer
  writeFileSync(join(KO, `${jobbId}.prompt.md`), prompt);
  return f;
}

export function status(jobbId: string): { status: "ferdig"; svar: string } | { status: "venter"; sekunder: number } | { status: "ukjent" } {
  if (!gyldigId(jobbId)) return { status: "ukjent" };
  const svarFil = join(KO, `${jobbId}.svar.json`);
  const forespFil = join(KO, `${jobbId}.foresporsel.json`);
  if (existsSync(svarFil)) return { status: "ferdig", svar: readFileSync(svarFil, "utf8") };
  if (existsSync(forespFil)) return { status: "venter", sekunder: Math.round((Date.now() - statSync(forespFil).mtimeMs) / 1000) };
  return { status: "ukjent" };
}
