import type { Kilde, Niva } from "@/lib/score";
import type { Samtykkeniva } from "@/lib/types";

// Status som pille, i bankens stil
const NIVA_STIL: Record<Niva, string> = {
  Kritisk: "bg-snb-rod text-white",
  Høy: "bg-snb-rod-lys text-snb-rod ring-1 ring-inset ring-red-200",
  "Følg med": "bg-snb-gronn-lys text-snb-gronn",
  Lav: "bg-white text-slate-600 ring-1 ring-inset ring-slate-200",
};

export function NivaPille({ niva }: { niva: Niva }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${NIVA_STIL[niva]}`}>{niva}</span>;
}

// Risikoscore som stolpe + tall: rød ved høy risiko, grønn ved lav
export function ScoreMerke({ score, niva, stor }: { score: number; niva: Niva; stor?: boolean }) {
  const farge = score >= 50 ? "bg-snb-rod" : score >= 30 ? "bg-red-700/70" : "bg-snb-gronn-mid";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`overflow-hidden rounded-full bg-slate-200 ${stor ? "h-2 w-32" : "h-1.5 w-20"}`}>
        <span className={`block h-full rounded-full ${farge}`} style={{ width: `${Math.max(4, score)}%` }} />
      </span>
      <span className={`tall font-bold text-slate-900 ${stor ? "text-base" : "text-sm"}`}>{score}</span>
      <NivaPille niva={niva} />
    </span>
  );
}

const KILDE_STIL: Record<Kilde, string> = {
  Prognose: "bg-snb-gronn-lys text-snb-gronn ring-teal-200",
  Bankdata: "bg-white text-slate-600 ring-slate-200",
  Regnskapssystem: "bg-white text-slate-600 ring-slate-200",
  "Åpne data": "bg-snb-rod-lys text-red-700 ring-red-200",
  Bransje: "bg-snb-gra text-slate-600 ring-slate-200",
  CRM: "bg-snb-gra text-slate-600 ring-slate-200",
  Tekstanalyse: "bg-snb-gronn-lys text-snb-gronn ring-teal-200",
};

export function KildeTag({ kilde }: { kilde: Kilde }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ring-1 ring-inset ${KILDE_STIL[kilde]}`}>{kilde}</span>;
}

// Kort: hvit flate med tynn ramme, grønn overtittel og rød overskrift
export function Kort({
  tittel,
  overtittel,
  children,
  hoyre,
  className = "",
}: {
  tittel?: string;
  overtittel?: string;
  children: React.ReactNode;
  hoyre?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-6 ${className}`}>
      {(tittel || overtittel) && (
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            {overtittel && <div className="overtittel mb-1">{overtittel}</div>}
            {tittel && <h2 className="font-overskrift text-lg font-bold text-snb-rod">{tittel}</h2>}
          </div>
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
        <span key={n} className={`h-2 w-2 rounded-full ${n <= niva ? "bg-snb-gronn" : "bg-slate-200"}`} />
      ))}
      <span className="ml-1">{tekst}</span>
    </span>
  );
}

export function Utnyttelse({ andel }: { andel: number }) {
  const farge = andel >= 0.9 ? "bg-snb-rod" : andel >= 0.6 ? "bg-red-700/60" : "bg-snb-gronn-mid";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${farge}`} style={{ width: `${Math.min(100, andel * 100)}%` }} />
      </div>
      <span className="tall text-xs text-slate-600">{Math.round(andel * 100)} %</span>
    </div>
  );
}

// Nøkkeltall-kort: liten etikett, stort rødt tall
export function Nokkeltall({ tittel, verdi, under, farge = "text-snb-rod" }: { tittel: string; verdi: number | string; under?: string; farge?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
      <div className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">{tittel}</div>
      <div className={`tall mt-1 font-overskrift text-4xl font-bold ${farge}`}>{verdi}</div>
      {under && <div className="mt-1 text-xs text-slate-600">{under}</div>}
    </div>
  );
}

// AI-boks: lys grønn med grønn venstrekant
export function AiBoks({ etikett, children }: { etikett: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-l-4 border-snb-gronn bg-snb-gronn-lys px-5 py-4 text-[15px] text-slate-800">
      <b className="text-snb-gronn">{etikett}</b> {children}
    </div>
  );
}
