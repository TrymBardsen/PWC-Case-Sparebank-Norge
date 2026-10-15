import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { hentKunde, hentVurderinger, portefolje } from "@/lib/data";
import { BriefSchema, lagFakta, lagMalBrief, SYSTEM, type Brief } from "@/lib/brief";

const MODELL = "claude-opus-5-5";

export async function POST(req: Request) {
  const { kundeId } = (await req.json()) as { kundeId: string };
  const kunde = hentKunde(kundeId);
  if (!kunde) return NextResponse.json({ feil: "Ukjent kunde" }, { status: 404 });

  const { vurderinger, smitte } = hentVurderinger();
  const fakta = lagFakta(kunde, vurderinger.get(kunde.id)!, smitte, portefolje.kunder);
  const mal = lagMalBrief(fakta, kunde);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ brief: mal, merknad: "Ingen ANTHROPIC_API_KEY satt – viser regelbasert mal." });
  }

  try {
    const client = new Anthropic();
    const svar = await client.beta.messages.parse({
      model: MODELL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(BriefSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `Fakta om kunden:\n${JSON.stringify(fakta, null, 1)}` }],
    });
    if (svar.stop_reason === "refusal" || !svar.parsed_output) {
      return NextResponse.json({ brief: mal, merknad: "Modellen ga ikke et gyldig svar – viser regelbasert mal." });
    }
    const brief: Brief = { ...svar.parsed_output, kilde: "claude", modell: svar.model };
    return NextResponse.json({ brief });
  } catch (e) {
    const melding = e instanceof Anthropic.APIError ? `${e.status ?? ""} ${e.message}` : String(e);
    console.error("Brief feilet:", melding);
    return NextResponse.json({ brief: mal, merknad: `Kallet til Claude feilet (${melding.slice(0, 120)}) – viser regelbasert mal.` });
  }
}
