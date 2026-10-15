import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { hentKunde } from "@/lib/data";
import { regelbasertAnalyse } from "@/lib/tekst";
import { analyserMedClaude, lagre } from "@/lib/tekstAi";

// Kjører tekstanalysen med Claude for én kunde og lagrer resultatet, så scoren oppdateres.
export async function POST(req: Request) {
  const { kundeId } = (await req.json()) as { kundeId: string };
  const kunde = hentKunde(kundeId);
  if (!kunde) return NextResponse.json({ feil: "Ukjent kunde" }, { status: 404 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ analyse: regelbasertAnalyse(kunde), merknad: "Ingen ANTHROPIC_API_KEY satt – viser regelbasert tekstanalyse." });
  }
  try {
    const analyse = await analyserMedClaude(kunde);
    lagre(kunde.id, analyse);
    return NextResponse.json({ analyse });
  } catch (e) {
    const melding = e instanceof Anthropic.APIError ? `${e.status ?? ""} ${e.message}` : String(e);
    console.error("Tekstanalyse feilet:", melding);
    return NextResponse.json({ analyse: regelbasertAnalyse(kunde), merknad: `Kallet til Claude feilet (${melding.slice(0, 120)}) – viser regelbasert analyse.` });
  }
}
