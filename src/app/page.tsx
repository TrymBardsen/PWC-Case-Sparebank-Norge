import Link from "next/link";
import { hentVurderinger, portefolje } from "@/lib/data";
import { DAGENS_DATO, dagerMellom, kortDato } from "@/lib/dato";
import { kr, mnok, omUker, prosent } from "@/lib/format";
import { Kort, SamtykkeMerke, ScoreMerke, Utnyttelse } from "@/components/ui";
import { hentMakro } from "@/lib/makro";
import { vurderGronn, type GronnVurdering } from "@/lib/gronn";
import { lagAgenda } from "@/lib/agenda";
import { Agenda } from "@/components/Agenda";
import { PortefoljeModus } from "@/components/PortefoljeModus";
import type { Kunde } from "@/lib/types";

// Dynamisk, så lagrede tekstanalyser slår inn i scoren med en gang
export const dynamic = "force-dynamic";

export default async function Portefoljeside() {
  const { vurderinger, smitte } = hentVurderinger();
  const makro = await hentMakro();
  const gronn = new Map<string, GronnVurdering>();
  for (const k of portefolje.kunder) {
    const g = vurderGronn(k, makro.stromNO5);
    if (g) gronn.set(k.id, g);
  }
  const agenda = lagAgenda(portefolje.kunder, vurderinger, smitte, gronn);
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

  const medAi = (
    <div className="space-y-6">
      <Agenda oppgaver={agenda} radgiver={portefolje.radgiver} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Nokkeltall tittel="Kritisk" verdi={kritiske} farge="text-red-600" />
        <Nokkeltall tittel="Høy prioritet" verdi={hoye} farge="text-orange-500" />
        <Nokkeltall tittel="Passerer insolvensgrensen innen 8 uker" verdi={tomInnen8} />
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
                <th className="px-3">Insolvensgrense</th>
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
                          <span className="block text-xs font-normal text-slate-500">
                            {omUker(v.prognose.ukerTilTomKasse!)} · {prosent(v.prognose.sannsynlighetInsolvens)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          –
                          {v.prognose.sannsynlighetInsolvens >= 0.1 && (
                            <span className="block text-xs text-amber-700">{prosent(v.prognose.sannsynlighetInsolvens)} sannsynlighet</span>
                          )}
                        </span>
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

      {gronn.size > 0 && <GronneMuligheter kunder={portefolje.kunder} gronn={gronn} />}
    </div>
  );

  return <PortefoljeModus medAi={medAi} utenAi={<UtenAi kunder={portefolje.kunder} />} />;
}

function GronneMuligheter({ kunder, gronn }: { kunder: Kunde[]; gronn: Map<string, GronnVurdering> }) {
  const rader = [...gronn.entries()]
    .map(([id, g]) => ({ k: kunder.find((x) => x.id === id)!, g }))
    .sort((a, b) => Number(b.g.gjennomforbar) - Number(a.g.gjennomforbar) || b.g.nodvendig.length - a.g.nodvendig.length || a.g.tilbakebetalingAar - b.g.tilbakebetalingAar);
  return (
    <Kort tittel="Grønne muligheter som styrker likviditeten">
      <p className="mb-3 text-sm text-slate-600">
        Kunder der et energitiltak er <b>nødvendig</b> (klimakrav fra egne kunder, høye strømkostnader) og <b>gjennomførbart</b> (grønt lån og Enova gir lavere
        kostnader uten å presse likviditeten).
      </p>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pl-5">Kunde og tiltak</th>
              <th className="px-3">Hvorfor nå</th>
              <th className="px-3 text-right">Spart per år</th>
              <th className="px-3 text-right">Netto etter termin</th>
              <th className="px-3 text-right">Tilbakebetalt</th>
              <th className="px-3 pr-5">Vurdering</th>
            </tr>
          </thead>
          <tbody>
            {rader.map(({ k, g }) => (
              <tr key={k.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="py-2.5 pl-5">
                  <Link href={`/kunde/${k.id}`} className="font-medium hover:text-teal-700 hover:underline">
                    {k.navn}
                  </Link>
                  <div className="text-xs text-slate-500">{g.navn}</div>
                </td>
                <td className="max-w-xs px-3 py-2.5 text-xs text-slate-600">{g.nodvendig[0] ?? "–"}</td>
                <td className="tall px-3 py-2.5 text-right">{kr(g.besparelsePerAar)}</td>
                <td className={`tall px-3 py-2.5 text-right ${g.nettoPerAar >= 0 ? "text-emerald-700" : "text-red-600"}`}>{kr(g.nettoPerAar)}</td>
                <td className="tall px-3 py-2.5 text-right">{Number.isFinite(g.tilbakebetalingAar) ? `${g.tilbakebetalingAar.toFixed(1).replace(".", ",")} år` : "–"}</td>
                <td className="px-3 py-2.5 pr-5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                      g.gjennomforbar ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"
                    }`}
                  >
                    {g.gjennomforbar ? "Gjennomførbar" : "Svak lønnsomhet"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Kort>
  );
}

// «Før»: kundeliste i alfabetisk rekkefølge og en innboks. Ingen prognose, ingen prioritering.
function UtenAi({ kunder }: { kunder: Kunde[] }) {
  const innboks = kunder
    .flatMap((k) => k.tekster.filter((t) => t.type === "epost").map((t) => ({ ...t, kunde: k.navn })))
    .sort((a, b) => b.dato.localeCompare(a.dato));
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
        Uten Likviditetsradar er det kunden som tar kontakt når pengene er brukt opp. Fjellsiden Bygg ville trolig ringt rundt 20. november, da lønnen ikke gikk
        gjennom. Bergenhus Transport sitt anbud står i en e-post, og ingen ser at underleverandørene til Fjellsiden også rammes.
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Kort tittel={`Innboks (${innboks.length} uleste)`}>
          <ul className="space-y-3">
            {innboks.map((t) => (
              <li key={t.id} className="text-sm">
                <div className="flex justify-between gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-800">{t.avsender}</span>
                  <span>{kortDato(t.dato)}</span>
                </div>
                <div className="text-xs font-medium text-slate-700">{t.tittel}</div>
                <div className="line-clamp-2 text-xs text-slate-500">{t.tekst}</div>
              </li>
            ))}
          </ul>
        </Kort>
        <Kort tittel="Kunder (alfabetisk)" className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5">Kunde</th>
                <th>Bransje</th>
                <th className="text-right">Saldo i dag</th>
                <th className="text-right">Kassekreditt</th>
              </tr>
            </thead>
            <tbody>
              {[...kunder]
                .sort((a, b) => a.navn.localeCompare(b.navn, "nb"))
                .map((k) => (
                  <tr key={k.id} className="tall border-b border-slate-100 last:border-0">
                    <td className="py-1.5">{k.navn}</td>
                    <td className="text-slate-500">{k.bransje}</td>
                    <td className="text-right">{kr(k.dagligSaldo[k.dagligSaldo.length - 1].saldo)}</td>
                    <td className="text-right text-slate-500">{kr(k.kassekredittRamme)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Kort>
      </div>
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
