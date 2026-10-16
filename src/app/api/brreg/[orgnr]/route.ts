import { NextResponse } from "next/server";
import { BrregUtilgjengelig, hentEnhet } from "@/lib/brreg";
import { DAGENS_DATO } from "@/lib/dato";
import { feil } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ orgnr: string }> }) {
  const { orgnr } = await params;
  if (!/^\d{9}$/.test(orgnr)) return feil(400, "Ugyldig organisasjonsnummer (9 siffer)");
  try {
    const enhet = await hentEnhet(orgnr, Number(DAGENS_DATO.slice(0, 4)));
    if (!enhet) return feil(404, "Fant ikke enheten i Enhetsregisteret");
    return NextResponse.json({ enhet, hentet: new Date().toISOString() });
  } catch (e) {
    if (e instanceof BrregUtilgjengelig) return feil(502, `Brønnøysundregistrene svarte ikke (${e.message}). Prøv igjen senere.`);
    throw e;
  }
}
