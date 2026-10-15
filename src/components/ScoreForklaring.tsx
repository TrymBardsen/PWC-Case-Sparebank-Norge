import type { Faktor } from "@/lib/score";

// Hvordan scoren er bygget opp: hvert signal som et segment på en skala fra 0 til 100,
// med nivågrensene markert. Identiteten står i teksten under, ikke bare i fargen.
const GRENSER = [
  { verdi: 15, navn: "Følg med" },
  { verdi: 30, navn: "Høy" },
  { verdi: 50, navn: "Kritisk" },
];

export function ScoreForklaring({ faktorer, score }: { faktorer: Faktor[]; score: number }) {
  const bidrag = faktorer.filter((f) => f.poeng > 0 && !f.ukjent).sort((a, b) => b.poeng - a.poeng);
  const sum = bidrag.reduce((s, f) => s + f.poeng, 0);
  const skala = Math.max(100, sum);

  return (
    <div className="mb-5">
      <div className="relative pt-5">
        {GRENSER.map((g) => (
          <span key={g.verdi} className="absolute top-0 -translate-x-1/2 text-[10px] whitespace-nowrap text-slate-500" style={{ left: `${(g.verdi / skala) * 100}%` }}>
            {g.navn}
          </span>
        ))}
        <div className="relative flex h-6 gap-0.5 overflow-hidden rounded bg-slate-100">
          {bidrag.map((f, i) => (
            <div
              key={f.id}
              title={`${f.navn}: ${f.poeng} poeng`}
              className="tall flex shrink-0 items-center justify-center text-[11px] font-semibold text-white first:rounded-l last:rounded-r"
              style={{ width: `${(f.poeng / skala) * 100}%`, background: i % 2 ? "#d9362d" : "#ff4238" }}
            >
              {f.poeng / skala >= 0.05 ? f.poeng : ""}
            </div>
          ))}
        </div>
        {GRENSER.map((g) => (
          <span key={g.verdi} className="absolute top-4 bottom-0 w-px bg-slate-900/40" style={{ left: `${(g.verdi / skala) * 100}%` }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>0</span>
        <span>{skala}</span>
      </div>
      <p className="tall mt-2 text-xs leading-relaxed text-slate-700">
        <b className="text-slate-900">{score} poeng</b> ={" "}
        {bidrag.length
          ? bidrag.map((f, i) => (
              <span key={f.id}>
                {i > 0 && " + "}
                <span className="whitespace-nowrap">{f.poeng}</span> {f.navn[0].toLowerCase() + f.navn.slice(1)}
              </span>
            ))
          : "ingen signaler"}
        {sum > score && ` (summen ${sum} er begrenset til 100)`}
      </p>
    </div>
  );
}
