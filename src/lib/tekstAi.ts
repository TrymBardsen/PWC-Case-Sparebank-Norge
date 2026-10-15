// Tekstanalyse med Claude. Modellen foreslår signaler med ordrette sitater;
// koden sjekker hvert sitat mot kilden og forkaster det som ikke står der.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Kunde } from "./types.ts";
import { alleTekster, KATEGORIER, verifiserSitat, type Tekstanalyse, type Tekstsignal } from "./tekst.ts";

export const MODELL = "claude-opus-5-5";

const SignalSchema = z.object({
  signaler: z.array(
    z.object({
      kildeId: z.string().describe("ID-en til kilden sitatet er hentet fra"),
      kategori: z.enum(KATEGORIER),
      alvor: z.number().describe("1 = svakt, 2 = tydelig, 3 = alvorlig"),
      oppsummering: z.string().describe("Én kort setning om hva signalet betyr for kundens likviditet eller omstilling"),
      sitat: z.string().describe("Ordrett utdrag fra kilden, maks én setning, kopiert tegn for tegn"),
      gjelderDebitor: z.string().nullable().describe("Navnet på en av kundens kunder fra listen, nøyaktig som skrevet, eller null"),
    }),
  ),
});

const SYSTEM = `Du er kredittanalytiker i en norsk bank. Du leser tekst om en bedriftskunde (rådgivernotater, e-post, nyheter, kunngjøringer) og finner signaler som er relevante for likviditet, kredittrisiko eller grønn omstilling.

Regler:
- Bruk bare det som står i kildene. Ikke trekk slutninger som teksten ikke støtter.
- sitat skal være kopiert ordrett fra kilden med samme kildeId, maks én setning. Sitater som ikke finnes i kilden blir forkastet automatisk.
- gjelderDebitor skal være et navn fra debitorlisten, skrevet nøyaktig likt, og bare når teksten tydelig handler om den kunden.
- Kategorier: kundetap, betalingsproblemer, etterspørsel, nedbemanning, klimakrav, grønn interesse, positiv.
- Maks ett signal per kategori per kilde. Ta med positive signaler også.
- Oppsummeringen skrives på norsk bokmål, kort og nøktern.`;

export async function analyserMedClaude(kunde: Kunde): Promise<Tekstanalyse> {
  const kilder = alleTekster(kunde);
  const client = new Anthropic();
  const svar = await client.beta.messages.parse({
    model: MODELL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(SignalSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          {
            kunde: kunde.navn,
            bransje: kunde.bransje,
            debitorer: kunde.debitorer.map((d) => ({ navn: d.navn, andelAvInnbetalinger: d.andelAvInnbetalinger })),
            kilder: kilder.map((k) => ({ id: k.id, type: k.type, dato: k.dato, avsender: k.avsender, tekst: k.tekst })),
          },
          null,
          1,
        ),
      },
    ],
  });
  if (svar.stop_reason === "refusal" || !svar.parsed_output) throw new Error("Modellen ga ikke et gyldig svar");

  const debitorNavn = new Set(kunde.debitorer.map((d) => d.navn));
  const forslag = svar.parsed_output.signaler;
  const godkjente: Tekstsignal[] = forslag
    .filter((s) => verifiserSitat(s, kilder))
    .map((s) => ({
      ...s,
      alvor: Math.min(3, Math.max(1, Math.round(s.alvor))) as 1 | 2 | 3,
      gjelderDebitor: s.gjelderDebitor && debitorNavn.has(s.gjelderDebitor) ? s.gjelderDebitor : null,
    }));

  return { metode: "claude", modell: svar.model, tidspunkt: new Date().toISOString(), signaler: godkjente, forkastet: forslag.length - godkjente.length };
}

// Lagrede analyser, så scoren ikke trenger et API-kall per sidevisning
const FIL = join(process.cwd(), "data", "tekstsignaler.json");

export function lesLagrede(): { endret: number; analyser: Record<string, Tekstanalyse> } {
  if (!existsSync(FIL)) return { endret: 0, analyser: {} };
  return { endret: statSync(FIL).mtimeMs, analyser: JSON.parse(readFileSync(FIL, "utf8")) };
}

export function lagre(kundeId: string, analyse: Tekstanalyse) {
  const { analyser } = lesLagrede();
  analyser[kundeId] = analyse;
  writeFileSync(FIL, JSON.stringify(analyser, null, 1));
}
