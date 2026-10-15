import type { Faktor, Niva } from "@/lib/score";
import { KildeTag, NivaPille } from "./ui";

// Hvorfor kunden har denne scoren: én stolpe der hvert signal er et segment (med nivågrensene
// under), og en liste over signalene som gir poeng. Signaler uten utslag og signaler som krever
// samtykke ligger sammenfoldet, så kortet ikke blir langt.
const GRENSER = [
  { verdi: 15, navn: "Følg med" },
  { verdi: 30, navn: "Høy" },
  { verdi: 50, navn: "Kritisk" },
];

export function ScoreForklaring({ faktorer, score, niva }: { faktorer: Faktor[]; score: number; niva: Niva }) {
  const bidrag = faktorer.filter((f) => f.poeng > 0 && !f.ukjent).sort((a, b) => b.poeng - a.poeng);
  const ingen = faktorer.filter((f) => f.poeng === 0 && !f.ukjent);
  const ukjente = faktorer.filter((f) => f.ukjent);
  const sum = bidrag.reduce((s, f) => s + f.poeng, 0);
  const skala = Math.max(100, sum);

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="tall font-overskrift text-4xl leading-none font-bold text-slate-900">{score}</span>
        <span className="text-sm text-slate-500">av 100</span>
        <span className="ml-auto self-center">
          <NivaPille niva={niva} />
        </span>
      </div>

      {/* Stolpe: ett segment per signal, hvite skiller mellom segmentene */}
      <div className="mt-3 flex h-5 overflow-hidden rounded-full bg-slate-100">
        {bidrag.map((f) => (
          <div
            key={f.id}
            title={`${f.navn}: ${f.poeng} poeng`}
            className="tall flex shrink-0 items-center justify-center border-r-2 border-white bg-snb-rod text-[10px] font-semibold text-white last:border-r-0"
            style={{ width: `${(f.poeng / skala) * 100}%` }}
          >
            {f.poeng / skala >= 0.06 ? f.poeng : ""}
          </div>
        ))}
      </div>
      <div className="relative mt-1 h-7 text-[10px] text-slate-500">
        {GRENSER.map((g) => (
          <span
            key={g.verdi}
            title={`${g.navn} fra ${g.verdi} poeng`}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${(g.verdi / skala) * 100}%` }}
          >
            <span className="h-1.5 w-px bg-slate-400" />
            <span className="whitespace-nowrap">{g.navn}</span>
          </span>
        ))}
      </div>
      {sum > score && <p className="text-[11px] text-slate-500">Summen av signalene er {sum}, men scoren er begrenset til 100.</p>}

      {/* Signalene som gir poeng */}
      <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
        {bidrag.map((f) => (
          <li key={f.id} className="flex gap-3 py-3">
            <span className="tall w-9 shrink-0 pt-px text-right font-overskrift text-sm font-bold text-snb-rod">+{f.poeng}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">{f.navn}</span>
                <KildeTag kilde={f.kilde} />
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{f.forklaring}</span>
              <span className="tall mt-0.5 block text-[11px] text-slate-400">
                {f.poeng} av maks {f.maks} poeng
              </span>
            </span>
          </li>
        ))}
        {bidrag.length === 0 && <li className="py-3 text-sm text-slate-500">Ingen signaler gir poeng nå.</li>}
      </ul>

      {(ingen.length > 0 || ukjente.length > 0) && (
        <details className="group mt-1 border-t border-slate-100 pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-snb-rod hover:underline">
            {ingen.length} signaler uten utslag{ukjente.length ? ` · ${ukjente.length} krever samtykke` : ""}
          </summary>
          <ul className="mt-2 space-y-2">
            {[...ukjente, ...ingen].map((f) => (
              <li key={f.id} className="text-xs">
                <span className="font-medium text-slate-700">{f.navn}</span>
                {f.ukjent && <span className="ml-1.5 rounded bg-amber-50 px-1.5 text-[10px] font-medium text-amber-800">krever samtykke</span>}
                <span className="block text-slate-500">{f.forklaring}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
