import Link from "next/link";
import type { Kunde } from "@/lib/types";
import { kildeTekst, MULIGHET_ETIKETT, type Mulighet } from "@/lib/muligheter";
import { Kort } from "./ui";

const VIS_FORST = 8;

export function MulighetEtikett({ m }: { m: Mulighet }) {
  return <span className="rounded-full bg-snb-gronn-lys px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-snb-gronn">{MULIGHET_ETIKETT[m.type]}</span>;
}

// Porteføljen: gode grunner til å ta kontakt, sortert etter kontaktverdi
export function MuligheterIPorteforljen({ muligheter, kunder }: { muligheter: Mulighet[]; kunder: Kunde[] }) {
  const navn = (id: string) => kunder.find((k) => k.id === id)!.navn;
  const rader = [...muligheter].sort((a, b) => b.verdi - a.verdi || navn(a.kundeId).localeCompare(navn(b.kundeId), "nb"));
  const antallKunder = new Set(rader.map((m) => m.kundeId)).size;
  if (!rader.length) return null;

  const Rad = ({ m }: { m: Mulighet }) => (
    <li className="grid grid-cols-1 gap-x-6 gap-y-1 py-3 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <Link href={`/kunde/${m.kundeId}`} className="font-overskrift font-bold text-slate-900 hover:text-snb-rod">
          {navn(m.kundeId)}
        </Link>
        <div className="mt-1">
          <MulighetEtikett m={m} />
        </div>
      </div>
      <div className="text-[13px] text-slate-700">
        {m.grunn}
        <div className="mt-0.5 text-xs text-slate-500">Kilde: {kildeTekst(m)}</div>
      </div>
      <div className="text-[13px] text-slate-700">
        <span className="font-semibold text-snb-gronn">Banken kan tilby: </span>
        {m.tilbud}
      </div>
    </li>
  );

  return (
    <Kort overtittel={`Vekst og gode kontaktgrunner · ${antallKunder} kunder`} tittel="Muligheter i porteføljen">
      <p className="mb-2 text-sm text-slate-600">
        Samme radar, motsatt retning: kunder som vokser, får nye kontrakter, bygger ut eller har ledig likviditet. Kunder i krise eller i en sensitiv situasjon er
        holdt utenfor.
      </p>
      <ul className="divide-y divide-slate-100">
        {rader.slice(0, VIS_FORST).map((m) => (
          <Rad key={m.id} m={m} />
        ))}
      </ul>
      {rader.length > VIS_FORST && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sm font-semibold text-snb-rod hover:underline">Vis {rader.length - VIS_FORST} muligheter til</summary>
          <ul className="divide-y divide-slate-100">
            {rader.slice(VIS_FORST).map((m) => (
              <Rad key={m.id} m={m} />
            ))}
          </ul>
        </details>
      )}
    </Kort>
  );
}

// Kundesiden (Oversikt): kundens muligheter
export function KundeMuligheter({ muligheter }: { muligheter: Mulighet[] }) {
  if (!muligheter.length) return null;
  return (
    <Kort overtittel="Gode grunner til kontakt" tittel={muligheter.length > 1 ? "Muligheter" : "Mulighet"}>
      <ul className="space-y-4">
        {muligheter.map((m) => (
          <li key={m.id} className="border-l-4 border-snb-gronn pl-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-overskrift text-base font-bold text-slate-900">{m.tittel}</span>
              <MulighetEtikett m={m} />
            </div>
            <p className="mt-1 text-sm text-slate-700">{m.grunn}</p>
            <p className="mt-1 text-sm text-slate-700">
              <span className="font-semibold text-snb-gronn">Banken kan tilby: </span>
              {m.tilbud}
            </p>
            <p className="mt-1 text-xs text-slate-500">Kilde: {kildeTekst(m)}</p>
          </li>
        ))}
      </ul>
    </Kort>
  );
}
