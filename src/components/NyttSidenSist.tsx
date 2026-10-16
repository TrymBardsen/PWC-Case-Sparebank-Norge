import Link from "next/link";
import type { Kunde } from "@/lib/types";
import type { Vurdering } from "@/lib/score";
import { DAGENS_DATO, kortDato, visDatoer } from "@/lib/dato";
import { endringerFor, VINDU_FRA, type Endring, type Retning } from "@/lib/endringer";
import { Kort, NivaPille } from "./ui";

const SYMBOL: Record<Retning, { tegn: string; etikett: string; stil: string }> = {
  verre: { tegn: "▲", etikett: "Verre", stil: "text-snb-rod" },
  bedre: { tegn: "▼", etikett: "Bedre", stil: "text-snb-gronn" },
  nytt: { tegn: "●", etikett: "Nytt", stil: "text-slate-400" },
};

const VIS_FORST = 8;

export function NyttSidenSist({ kunder, vurderinger }: { kunder: Kunde[]; vurderinger: Map<string, Vurdering> }) {
  const rader = kunder
    .map((k) => ({ k, v: vurderinger.get(k.id)!, e: endringerFor(k) }))
    .filter((r) => r.e.length > 0)
    .map((r) => ({ ...r, verre: r.e.filter((x) => x.retning === "verre").reduce((s, x) => s + x.vekt, 0) }))
    // Forverringer først, deretter kunder med høy score
    .sort((a, b) => b.verre - a.verre || b.v.score - a.v.score);

  const teller = (retning: Retning) => rader.reduce((s, r) => s + r.e.filter((x) => x.retning === retning).length, 0);
  // Kunder med lav risiko vises bare på forespørsel, så listen ikke drukner i små saldoendringer
  const viktige = rader.filter((r) => r.v.niva !== "Lav");
  const lave = rader.filter((r) => r.v.niva === "Lav");

  return (
    <Kort
      overtittel={`${kortDato(VINDU_FRA)} – ${kortDato(DAGENS_DATO)} · transaksjoner og registerhendelser`}
      tittel="Hva er nytt siste 14 dager"
      hoyre={
        <span className="flex gap-3 text-xs text-slate-600">
          <Telling retning="verre" antall={teller("verre")} />
          <Telling retning="bedre" antall={teller("bedre")} />
          <Telling retning="nytt" antall={teller("nytt")} />
        </span>
      }
    >
      {rader.length === 0 ? (
        <p className="text-sm text-slate-500">Ingen endringer i porteføljen de siste 14 dagene.</p>
      ) : (
        <>
          {viktige.length ? <Liste rader={viktige.slice(0, VIS_FORST)} /> : <p className="text-sm text-slate-500">Ingen endringer hos kunder med risiko de siste 14 dagene.</p>}
          {viktige.length > VIS_FORST && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-snb-rod hover:underline">Vis {viktige.length - VIS_FORST} kunder til</summary>
              <Liste rader={viktige.slice(VIS_FORST)} />
            </details>
          )}
          {lave.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-snb-rod hover:underline">Vis {lave.length} endringer hos kunder med lav risiko</summary>
              <Liste rader={lave} />
            </details>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Kassekreditt: snittutnyttelse siste 7 dager mot de 7 dagene for to uker siden (bare når 80 % eller 100 % passeres). Saldo: snitt siste uke mot uken før,
            når endringen er minst 25 % av rammen.
          </p>
        </>
      )}
    </Kort>
  );
}

function Liste({ rader }: { rader: { k: Kunde; v: Vurdering; e: Endring[] }[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {rader.map(({ k, v, e }) => (
        <li key={k.id} className="grid grid-cols-1 gap-x-4 gap-y-1 py-2.5 md:grid-cols-[minmax(0,15rem)_1fr]">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/kunde/${k.id}`} className="font-overskrift font-bold text-slate-900 hover:text-snb-rod">
              {k.navn}
            </Link>
            <NivaPille niva={v.niva} />
          </div>
          <ul className="space-y-0.5 text-[13px] text-slate-700">
            {e.map((x, i) => (
              <li key={i} className="flex gap-2">
                <span className={`shrink-0 ${SYMBOL[x.retning].stil}`} aria-label={SYMBOL[x.retning].etikett} title={SYMBOL[x.retning].etikett}>
                  {SYMBOL[x.retning].tegn}
                </span>
                <span className="min-w-0">{visDatoer(x.tekst)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Telling({ retning, antall }: { retning: Retning; antall: number }) {
  const s = SYMBOL[retning];
  return (
    <span className="whitespace-nowrap">
      <span className={s.stil}>{s.tegn}</span> {antall} {s.etikett.toLowerCase()}
    </span>
  );
}
