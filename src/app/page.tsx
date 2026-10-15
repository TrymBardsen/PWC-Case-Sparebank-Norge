import Link from "next/link";
import { hentVurderinger, portefolje } from "@/lib/data";
import { dagerSiden, kortDato } from "@/lib/dato";
import { kr, mnok, omUker, prosent } from "@/lib/format";
import { AiBoks, Kort, Nokkeltall, SamtykkeMerke, ScoreMerke, Utnyttelse } from "@/components/ui";
import { hentMakro } from "@/lib/makro";
import { vurderGronn, type GronnVurdering } from "@/lib/gronn";
import { lagAgenda } from "@/lib/agenda";
import { Agenda } from "@/components/Agenda";
import { PortefoljeModus } from "@/components/PortefoljeModus";
import type { Kunde } from "@/lib/types";

// Dynamisk, så lagrede tekstanalyser slår inn i scoren med en gang
export const dynamic = "force-dynamic";

export default async function Portefoljeside({ searchParams }: { searchParams: Promise<{ alle?: string }> }) {
  const visAlle = (await searchParams).alle === "1";
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
  const glemte = rader.filter((r) => (dagerSiden(r.k.sisteKontakt) ?? Infinity) > 365).length;
  const totalRamme = portefolje.kunder.reduce((s, k) => s + k.kassekredittRamme, 0);
  const totalBrukt = rader.reduce((s, r) => s + r.k.kassekredittTrekk[r.k.kassekredittTrekk.length - 1], 0);
  const aktivSmitte = smitte.filter((s) => (vurderinger.get(s.fra)?.score ?? 0) >= 50);

  const medAi = (
    <div className="space-y-6">
      <Agenda oppgaver={agenda} radgiver={portefolje.radgiver} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Nokkeltall tittel="Kritisk" verdi={kritiske} under="Score 50 eller høyere" />
        <Nokkeltall tittel="Høy prioritet" verdi={hoye} under="Score 30–49" />
        <Nokkeltall tittel="Skvis innen 8 uker" verdi={tomInnen8} under="Passerer insolvensgrensen" />
        <Nokkeltall tittel="Ikke kontaktet siste år" verdi={glemte} under={`Av ${rader.length} kunder`} />
        <Nokkeltall tittel="Kassekreditt brukt" verdi={`${Math.round((totalBrukt / totalRamme) * 100)} %`} under={`${mnok(totalBrukt)} av ${mnok(totalRamme)}`} />
      </div>

      <AiBoks etikett="Ukens oppsummering:">
        {(() => {
          const kritiskeNavn = rader.filter((r) => r.v.niva === "Kritisk").map((r) => r.k.navn);
          const motpart = rader.filter((r) => r.k.motpart).map((r) => r.k.navn);
          const sensitive = rader.filter((r) => r.k.sensitiv).map((r) => r.k.navn);
          return [
            kritiskeNavn.length ? `${kritiskeNavn.length} kunder er kritiske, og ${kritiskeNavn[0]} har høyest risiko og bør kontaktes i dag.` : "Ingen kunder er kritiske nå.",
            motpart.length ? `${motpart.join(" og ")} er avhengige av en motpart som har fått betalingsanmerkning.` : "",
            sensitive.length ? `${sensitive.join(" og ")} er i en sensitiv situasjon og er tatt ut av agendaen.` : "",
          ]
            .filter(Boolean)
            .join(" ");
        })()}
      </AiBoks>

      <Kort
        overtittel={`Sortert etter risikoscore · ${visAlle ? `alle ${rader.length}` : `topp ${Math.min(30, rader.length)} av ${rader.length}`} kunder`}
        tittel="Varsler i porteføljen"
        hoyre={
          <Link href={visAlle ? "/" : "/?alle=1"} className="text-sm font-semibold text-snb-rod hover:underline">
            {visAlle ? "Vis bare de 30 viktigste" : `Vis alle ${rader.length}`}
          </Link>
        }
      >
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-snb-gronn text-left text-[13px] font-semibold text-white">
                <th className="py-3 pl-6 pr-3">Kunde</th>
                <th className="px-3 py-3">Risikoscore</th>
                <th className="px-3 py-3">Tid til skvis</th>
                <th className="px-3 py-3">Viktigste signal</th>
                <th className="px-3 py-3">Kassekreditt</th>
                <th className="px-3 py-3">Siste kontakt</th>
                <th className="px-3 py-3">Data</th>
                <th className="py-3 pr-6 pl-3" />
              </tr>
            </thead>
            <tbody>
              {(visAlle ? rader : rader.slice(0, 30)).map(({ k, v }) => {
                const toppFaktorer = [...v.faktorer].filter((f) => f.poeng > 0).sort((a, b) => b.poeng - a.poeng).slice(0, 2);
                const dager = dagerSiden(k.sisteKontakt);
                return (
                  <tr key={k.id} className="group border-b border-slate-200 align-top last:border-0 even:bg-snb-gra/60 hover:bg-snb-gra">
                    <td className="py-4 pl-6 pr-3">
                      <Link href={`/kunde/${k.id}`} className="font-overskrift text-[15px] font-bold text-slate-900 group-hover:text-snb-rod">
                        {k.navn}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {k.bransje} · {k.adresse}
                        {k.sesongbedrift ? " · sesongbedrift" : ""}
                      </div>
                      {k.sensitiv && (
                        <div className="mt-1 inline-block rounded-full bg-snb-gronn-lys px-2 py-0.5 text-[10px] font-semibold text-snb-gronn" title={k.sensitiv}>
                          Sensitiv situasjon – kun praktisk kontakt
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <ScoreMerke score={v.score} niva={v.niva} />
                    </td>
                    <td className="tall px-3 py-4 whitespace-nowrap">
                      {v.prognose.tomKasseDato ? (
                        <span className={v.prognose.ukerTilTomKasse! <= 2 ? "font-semibold text-snb-rod" : "font-medium text-red-700"}>
                          {omUker(v.prognose.ukerTilTomKasse!)}
                          <span className="block text-xs font-normal text-slate-500">
                            {kortDato(v.prognose.tomKasseDato)} · {prosent(v.prognose.sannsynlighetInsolvens)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          13+ uker
                          {v.prognose.sannsynlighetInsolvens >= 0.1 && (
                            <span className="block text-xs text-red-700">{prosent(v.prognose.sannsynlighetInsolvens)} sannsynlighet</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="max-w-sm px-3 py-4 text-[13px] text-slate-700">
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
                    <td className="px-3 py-4">
                      <Utnyttelse andel={v.kkUtnyttelse} />
                    </td>
                    <td className={`tall px-3 py-4 text-xs whitespace-nowrap ${dager === null || dager > 365 ? "font-semibold text-red-700" : "text-slate-600"}`}>
                      {dager === null ? "Ingen registrert" : `${dager} dager siden`}
                    </td>
                    <td className="px-3 py-4">
                      <SamtykkeMerke niva={k.samtykke} />
                    </td>
                    <td className="py-4 pr-6 pl-3 text-right">
                      <Link href={`/kunde/${k.id}`} className="font-semibold whitespace-nowrap text-snb-rod hover:underline">
                        Åpne →
                      </Link>
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

  const kritiskeKunder = rader.filter((r) => r.v.niva === "Kritisk").map((r) => ({ navn: r.k.navn, dato: r.v.prognose.tomKasseDato }));
  return <PortefoljeModus medAi={medAi} utenAi={<UtenAi kunder={portefolje.kunder} kritiske={kritiskeKunder} />} />;
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
                  <Link href={`/kunde/${k.id}`} className="font-medium hover:text-snb-rod hover:underline">
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
function UtenAi({ kunder, kritiske }: { kunder: Kunde[]; kritiske: { navn: string; dato: string | null }[] }) {
  // Hendelser som kommer inn uten sortering eller kobling til kundens situasjon
  const innboks = kunder
    .flatMap((k) => k.tekster.map((t) => ({ ...t, kunde: k.navn })))
    .sort((a, b) => b.dato.localeCompare(a.dato))
    .slice(0, 15);
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
        Uten Likviditetsradar er det kunden som tar kontakt når pengene er brukt opp. {kunder.length} kunder i alfabetisk rekkefølge og en strøm av
        registerhendelser gir ingen prioritering.{" "}
        {kritiske.length > 0 &&
          `${kritiske.map((k) => k.navn).join(", ")} er allerede kritiske, men ingenting her viser det før de selv tar kontakt.`}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Kort tittel="Siste hendelser (usortert)">
          <ul className="space-y-3">
            {innboks.map((t) => (
              <li key={t.id} className="text-sm">
                <div className="flex justify-between gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-800">{t.kunde}</span>
                  <span>{kortDato(t.dato)}</span>
                </div>
                <div className="text-xs font-medium text-slate-700">{t.avsender}</div>
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
