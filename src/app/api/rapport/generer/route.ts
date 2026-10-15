import { NextResponse } from "next/server";
import { hentKunde, hentVurderinger } from "@/lib/data";
import { byggKildekatalog, lagPrompt } from "@/lib/rapport";
import { leggIKo } from "@/lib/kiKo";

// Starter en rapportjobb. Prompten bygges her på serveren fra bankens data,
// og legges i køen som Claude svarer på (se src/lib/kiKo.ts).
export async function POST(req: Request) {
  const { kundeId } = (await req.json()) as { kundeId: string };
  const kunde = hentKunde(kundeId);
  if (!kunde) return NextResponse.json({ feil: "Ukjent kunde" }, { status: 404 });
  const { vurderinger, smitte } = hentVurderinger();
  const katalog = byggKildekatalog(kunde, vurderinger.get(kunde.id)!, smitte);
  const jobb = leggIKo(kunde.id, lagPrompt(kunde, katalog));
  return NextResponse.json({ jobbId: jobb.jobbId, status: "venter" }, { status: 202 });
}
