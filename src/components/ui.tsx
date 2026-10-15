import type { Kilde, Niva } from "@/lib/score";
import type { Samtykkeniva } from "@/lib/types";

const NIVA_STIL: Record<Niva, string> = {
  Kritisk: "bg-red-600 text-white",
  Høy: "bg-orange-500 text-white",
  "Følg med": "bg-amber-200 text-amber-950",
  Lav: "bg-slate-200 text-slate-700",
};

export function ScoreMerke({ score, niva, stor }: { score: number; niva: Niva; stor?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-semibold tall ${NIVA_STIL[niva]} ${stor ? "px-3 py-1.5 text-base" : "px-2 py-0.5 text-xs"}`}>
      {score}
      <span className="font-normal opacity-90">{niva}</span>
    </span>
  );
}

const KILDE_STIL: Record<Kilde, string> = {
  Prognose: "bg-teal-50 text-teal-800 ring-teal-200",
  Bankdata: "bg-sky-50 text-sky-800 ring-sky-200",
  Regnskapssystem: "bg-violet-50 text-violet-800 ring-violet-200",
  "Åpne data": "bg-amber-50 text-amber-800 ring-amber-200",
  Bransje: "bg-slate-50 text-slate-600 ring-slate-200",
  CRM: "bg-slate-50 text-slate-600 ring-slate-200",
  Tekstanalyse: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
};

export function KildeTag({ kilde }: { kilde: Kilde }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${KILDE_STIL[kilde]}`}>{kilde}</span>;
}

export function Kort({ tittel, children, hoyre, className = "" }: { tittel?: string; children: React.ReactNode; hoyre?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {tittel && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{tittel}</h2>
          {hoyre}
        </div>
      )}
      {children}
    </section>
  );
}

export function SamtykkeMerke({ niva }: { niva: Samtykkeniva }) {
  const tekst = niva === 1 ? "Bankdata" : niva === 2 ? "+ Regnskap" : "+ Privat";
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600" title={`Samtykkenivå ${niva}`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={`h-2 w-2 rounded-full ${n <= niva ? "bg-teal-600" : "bg-slate-200"}`} />
      ))}
      <span className="ml-1">{tekst}</span>
    </span>
  );
}

export function Utnyttelse({ andel }: { andel: number }) {
  const farge = andel >= 1 ? "bg-red-600" : andel >= 0.9 ? "bg-orange-500" : andel >= 0.6 ? "bg-amber-400" : "bg-teal-600";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${farge}`} style={{ width: `${Math.min(100, andel * 100)}%` }} />
      </div>
      <span className="tall text-xs text-slate-600">{Math.round(andel * 100)} %</span>
    </div>
  );
}
