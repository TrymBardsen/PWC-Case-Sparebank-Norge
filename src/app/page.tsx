import Link from "next/link";
import { hentVurderinger, portefolje } from "@/lib/data";
import { DAGENS_DATO, dagerMellom, kortDato } from "@/lib/dato";
import { mnok, omUker } from "@/lib/format";
import { Kort, SamtykkeMerke, ScoreMerke, Utnyttelse } from "@/components/ui";

export default function Portefoljeside() {
  const { vurderinger, smitte } = hentVurderinger();
  const rader = portefolje.kunder
    .map((k) => ({ k, v: vurderinger.get(k.id)! }))
    .sort((a, b) => b.v.score - a.v.score);

  const kritiske = rader.filter((r) => r.v.niva === "Kritisk").length;
  const hoye = rader.filter((r) => r.v.niva === "Høy").length;
  const tomInnen8 = rader.filter((r) => r.v.prognose.ukerTilTomKasse !== null && r.v.prognose.ukerTilTomKasse <= 8).length;
  const glemte = rader.filter((r) => dagerMellom(r.k.sisteKontakt, DAGENS_DATO) > 120).length;
  const totalRamme = portefolje.kunder.reduce((s, k) => s + k.kassekredittRamme, 0);
  const totalBrukt = rader.reduce((s, r) => s + Math.max(0, -r.k.dagligSaldo[r.k.dagligSaldo.length - 1].saldo), 0);
  const aktivSmitte = smitte.filter((s) => (vurderinger.get(s.fra)?.score ?? 0) >= 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">God morgen, Kari</h1>
          <p className="text-sm text-slate-600">
            {portefolje.kunder.length} bedriftskunder i porteføljen. Listen er sortert etter hvem som trenger deg mest akkurat nå.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Nokkeltall tittel="Kritisk" verdi={kritiske} farge="text-red-600" />
        <Nokkeltall tittel="Høy prioritet" verdi={hoye} farge="text-orange-500" />
        <Nokkeltall tittel="Tom kasse innen 8 uker" verdi={tomInnen8} />
        <Nokkeltall tittel="Ikke kontaktet på 4 mnd" verdi={glemte} />
        <Nokkeltall tittel="Kassekreditt brukt" verdi={`${Math.round((totalBrukt / totalRamme) * 100)} %`} under={`${mnok(totalBrukt)} av ${mnok(totalRamme)}`} />
      </div>

      <Kort tittel="Prioriteringsliste">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                <th className="py-2 pl-5 pr-3">Score</th>
                <th className="px-3">Kunde</th>
                <th className="px-3">Hvorfor</th>
                <th className="px-3">Tom kasse</th>
                <th className="px-3">Kassekreditt</th>
                <th className="px-3">Siste kontakt</th>
                <th className="px-3 pr-5">Datagrunnlag</th>
              </tr>
            </thead>
            <tbody>
              {rader.map(({ k, v }) => {
                const toppFaktorer = [...v.faktorer].filter((f) => f.poeng > 0).sort((a, b) => b.poeng - a.poeng).slice(0, 2);
                const dager = dagerMellom(k.sisteKontakt, DAGENS_DATO);
                return (
                  <tr key={k.id} className="group border-b border-slate-100 align-top last:border-0 hover:bg-slate-50">
                    <td className="py-3 pl-5 pr-3">
                      <ScoreMerke score={v.score} niva={v.niva} />
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/kunde/${k.id}`} className="font-medium text-slate-900 group-hover:text-teal-700 group-hover:underline">
                        {k.navn}
                      </Link>
                      <div className="text-xs text-slate-500">{k.bransje}{k.sesongbedrift ? " · sesongbedrift" : ""}</div>
                    </td>
                    <td className="max-w-md px-3 py-3 text-xs text-slate-700">
                      {toppFaktorer.length ? (
                        <ul className="space-y-0.5">
                          {toppFaktorer.map((f) => (
                            <li key={f.id}>{f.forklaring}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">Ingen signaler</span>
                      )}
                    </td>
                    <td className="tall px-3 py-3 whitespace-nowrap">
                      {v.prognose.tomKasseDato ? (
                        <span className={v.prognose.ukerTilTomKasse! <= 2 ? "font-semibold text-red-600" : "font-medium text-orange-600"}>
                          {kortDato(v.prognose.tomKasseDato)}
                          <span className="block text-xs font-normal text-slate-500">{omUker(v.prognose.ukerTilTomKasse!)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Utnyttelse andel={v.kkUtnyttelse} />
                    </td>
                    <td className={`tall px-3 py-3 text-xs whitespace-nowrap ${dager > 120 ? "font-medium text-orange-600" : "text-slate-600"}`}>
                      {dager} dager siden
                    </td>
                    <td className="px-3 py-3 pr-5">
                      <SamtykkeMerke niva={k.samtykke} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Kort>

      {aktivSmitte.length > 0 && (
        <Kort tittel="Smitteeffekter i porteføljen">
          <p className="mb-3 text-sm text-slate-600">
            Banken ser betalingsstrømmene mellom egne kunder. Når én kunde sliter, rammes leverandørene som er avhengige av den.
          </p>
          <div className="flex flex-wrap gap-3">
            {aktivSmitte.map((s) => {
              const fra = portefolje.kunder.find((k) => k.id === s.fra)!;
              const til = portefolje.kunder.find((k) => k.id === s.til)!;
              return (
                <div key={s.fra + s.til} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <Link className="font-medium text-red-700 hover:underline" href={`/kunde/${fra.id}`}>{fra.navn}</Link>
                  <span className="text-slate-400">→</span>
                  <Link className="font-medium hover:underline" href={`/kunde/${til.id}`}>{til.navn}</Link>
                  <span className="text-xs text-slate-500">{Math.round(s.andel * 100)} % av innbetalingene</span>
                </div>
              );
            })}
          </div>
        </Kort>
      )}
    </div>
  );
}

function Nokkeltall({ tittel, verdi, farge = "text-slate-900", under }: { tittel: string; verdi: number | string; farge?: string; under?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs text-slate-500">{tittel}</div>
      <div className={`tall text-2xl font-semibold ${farge}`}>{verdi}</div>
      {under && <div className="text-xs text-slate-500">{under}</div>}
    </div>
  );
}
