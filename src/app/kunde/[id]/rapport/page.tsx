import Link from "next/link";
import { notFound } from "next/navigation";
import { hentKunde, hentVurderinger } from "@/lib/data";
import { byggKildekatalog, lagPrompt } from "@/lib/rapport";
import { langDato, DAGENS_DATO } from "@/lib/dato";
import { Moterapport } from "@/components/Moterapport";

export const dynamic = "force-dynamic";

export default async function Rapportside({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kunde = hentKunde(id);
  if (!kunde) notFound();
  const { vurderinger, smitte } = hentVurderinger();
  const katalog = byggKildekatalog(kunde, vurderinger.get(kunde.id)!, smitte);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href={`/kunde/${kunde.id}`} className="text-sm font-semibold text-snb-rod hover:underline">
          ← Tilbake til kundeanalysen
        </Link>
        <div className="overtittel mt-3 mb-1">Før samtalen</div>
        <h1 className="font-overskrift text-3xl font-bold text-snb-rod">Møterapport: {kunde.navn}</h1>
        <p className="mt-1 text-sm text-slate-600">
          KI-generert rapport på én side med kildehenvisninger. Bygger bare på bankens data for kunden ({katalog.length} kilder) og nyheter om bransje, region og
          makro.
        </p>
      </div>
      <Moterapport kundeId={kunde.id} kundenavn={kunde.navn} dato={langDato(DAGENS_DATO)} prompt={lagPrompt(kunde, katalog)} katalog={katalog} />
    </div>
  );
}
