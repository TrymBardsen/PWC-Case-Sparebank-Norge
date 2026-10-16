import { NextResponse } from "next/server";
import { hentKunde, hentVurderinger, portefolje } from "@/lib/data";
import { lagBriefPrompt, lagFakta } from "@/lib/brief";
import { leggIKo } from "@/lib/kiKo";
import { feil, KundeForesporsel, lesJson } from "@/lib/api";

// Starter et samtaleunderlag via køen på disk. En Claude Code-økt i Claude Desktop svarer,
// og nettsiden henter svaret fra /api/rapport/status (samme kø som møterapporten).
export async function POST(req: Request) {
  const tolket = await lesJson(req, KundeForesporsel);
  if (!tolket.ok) return tolket.svar;
  const kunde = hentKunde(tolket.data.kundeId);
  if (!kunde) return feil(404, "Ukjent kunde");
  const { vurderinger, smitte } = hentVurderinger();
  const vurdering = vurderinger.get(kunde.id);
  if (!vurdering) return feil(500, "Mangler vurdering for kunden");
  const fakta = lagFakta(kunde, vurdering, smitte, portefolje.kunder);
  const jobb = leggIKo(kunde.id, lagBriefPrompt(fakta, kunde.id), "samtaleunderlag");
  return NextResponse.json({ jobbId: jobb.jobbId, status: "venter" }, { status: 202 });
}
