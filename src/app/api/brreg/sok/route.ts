import { NextResponse } from "next/server";
import { BrregUtilgjengelig, sokEnheter } from "@/lib/brreg";
import { feil } from "@/lib/api";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ treff: [] });
  if (q.length > 100) return feil(400, "Søket er for langt (maks 100 tegn)");
  try {
    return NextResponse.json({ treff: await sokEnheter(q) });
  } catch (e) {
    if (e instanceof BrregUtilgjengelig) return feil(502, `Brønnøysundregistrene svarte ikke (${e.message}). Prøv igjen senere.`);
    throw e;
  }
}
