import { NextResponse } from "next/server";
import { hentEnhet } from "@/lib/brreg";
import { DAGENS_DATO } from "@/lib/dato";

export async function GET(_req: Request, { params }: { params: Promise<{ orgnr: string }> }) {
  const { orgnr } = await params;
  if (!/^\d{9}$/.test(orgnr)) return NextResponse.json({ feil: "Ugyldig organisasjonsnummer" }, { status: 400 });
  const enhet = await hentEnhet(orgnr, Number(DAGENS_DATO.slice(0, 4)));
  if (!enhet) return NextResponse.json({ feil: "Fant ikke enheten" }, { status: 404 });
  return NextResponse.json({ enhet });
}
