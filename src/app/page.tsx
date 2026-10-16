import Link from "next/link";
import { hentVurderinger, portefolje } from "@/lib/data";
import { dagerSiden, kortDato, visDatoer } from "@/lib/dato";
import { kr, mnok, omUker, prosent } from "@/lib/format";
import { AiBoks, Kort, Nokkeltall } from "@/components/ui";
import { hentMakro } from "@/lib/makro";
import { vurderGronn, type GronnVurdering } from "@/lib/gronn";
import { lagAgenda } from "@/lib/agenda";
import { Agenda } from "@/components/Agenda";
import { PortefoljeModus } from "@/components/PortefoljeModus";
import { NyttSidenSist } from "@/components/NyttSidenSist";
import { Minigraf } from "@/components/Minigraf";
import { MuligheterIPorteforljen } from "@/components/Muligheter";
import { muligheterFor } from "@/lib/muligheter";
import type { Kunde } from "@/lib/types";
import { Portefoljetabell, type Rad } from "@/components/Portefoljetabell";
import { Seksjon } from "@/components/Seksjon";
import { antall } from "@/lib/format";
import { mineKunder } from "@/lib/radgiver";

// Dynamisk, så lagrede tekstanalyser slår inn i scoren med en gang
export const dynamic = "force-dynamic";

export default async function Portefoljeside() {
  // Scoren beregnes for hele porteføljen (smitte går på tvers), men siden viser den valgte rådgiverens kunder
  const { vurderinger, smitte } = hentVurderinger();
  const { radgiver, kunder } = await mineKunder();
  const mine = new Set(kunder.map((k) => k.id));
  const makro = await hentMakro();
  const gronn = new Map<string, GronnVurdering>();
  for (const k of kunder) {
    const g = vurderGronn(k, makro.stromNO5);
    if (g) gronn.set(k.id, g);
  }
  const agenda = lagAgenda(kunder, vurderinger, smitte, gronn);
  const rader = kunder
    .map((k) => ({ k, v: vurderinger.get(k.id)! }))
    .sort((a, b) => b.v.score - a.v.score);

  const kritiske = rader.filter((r) => r.v.niva === "Kritisk").length;
  const hoye = rader.filter((r) => r.v.niva === "Høy").length;
  const tomInnen8 = rader.filter((r) => r.v.prognose.ukerTilTomKasse !== null && r.v.prognose.ukerTilTomKasse <= 8).length;
  const glemte = rader.filter((r) => (dagerSiden(r.k.sisteKontakt) ?? Infinity) > 365).length;
  const totalRamme = kunder.reduce((s, k) => s + k.kassekredittRamme, 0);
  const totalBrukt = rader.reduce((s, r) => s + r.k.kassekredittTrekk[r.k.kassekredittTrekk.length - 1], 0);
  const aktivSmitte = smitte.filter((s) => (vurderinger.get(s.fra)?.score ?? 0) >= 50 && (mine.has(s.fra) || mine.has(s.til)));
  const muligheter = kunder.flatMap((k) => muligheterFor(k, vurderinger.get(k.id)!));

  const medAi = (
    <div className="space-y-6">
      <Agenda oppgaver={agenda} radgiver={radgiver} kunder={kunder.map((k) => ({ id: k.id, navn: k.navn, dagligLeder: k.dagligLeder }))} />

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
            kritiskeNavn.length
              ? `${antall(kritiskeNavn.length, "kunde er kritisk", "kunder er kritiske")}, og ${kritiskeNavn[0]} har høyest risiko og bør kontaktes i dag.`
              : "Ingen kunder er kritiske nå.",
            motpart.length ? `${motpart.join(" og ")} er avhengige av en motpart som har fått betalingsanmerkning.` : "",
            sensitive.length ? `${sensitive.join(" og ")} er i en sensitiv situasjon og er tatt ut av agendaen.` : "",
            muligheter.length
              ? `${antall(new Set(muligheter.map((m) => m.kundeId)).size, "kunde har", "kunder har")} en god grunn til kontakt, blant annet ${antall(muligheter.filter((m) => m.type === "kontrakt").length, "ny offentlig kontrakt", "nye offentlige kontrakter")} og ${antall(muligheter.filter((m) => m.type === "vekst").length, "kunde", "kunder")} der veksten binder likviditet.`
              : "",
          ]
            .filter(Boolean)
            .join(" ");
        })()}
      </AiBoks>

      <Portefoljetabell
        rader={rader.map(({ k, v }): Rad => {
          const p = v.prognose;
          const topp = [...v.faktorer].filter((f) => f.poeng > 0).sort((a, b) => b.poeng - a.poeng).slice(0, 2);
          return {
            id: k.id,
            navn: k.navn,
            undertekst: `${k.bransje} · ${k.adresse}${k.sesongbedrift ? " · sesongbedrift" : ""}`,
            sensitiv: k.sensitiv,
            score: v.score,
            niva: v.niva,
            bransje: k.bransje,
            tid: p.tomKasseDato
              ? {
                  tekst: omUker(p.ukerTilTomKasse!),
                  under: `${kortDato(p.tomKasseDato)} · ${antall(p.dagerUnderGrensen, "dag", "dager")} under · ${prosent(p.sannsynlighetInsolvens)}`,
                  stil: p.ukerTilTomKasse! <= 2 ? "font-semibold text-snb-rod" : "font-medium text-red-700",
                }
              : { tekst: "13+ uker", under: p.sannsynlighetInsolvens >= 0.1 ? `${prosent(p.sannsynlighetInsolvens)} sannsynlighet` : undefined, stil: "text-slate-500" },
            signal: topp[0] ? visDatoer(topp[0].forklaring) : undefined,
            ogsa: topp[1]?.navn.toLowerCase(),
            kk: v.kkUtnyttelse,
            dagerSiden: dagerSiden(k.sisteKontakt),
            samtykke: k.samtykke,
            graf: <Minigraf historikk={k.dagligSaldo} prognose={p} />,
          };
        })}
      />

      <Seksjon tittel="Hva er nytt siste 14 dager" undertittel="Endringer hos kunder med risiko · kunder med lav risiko kan vises inni">
        <NyttSidenSist kunder={kunder} vurderinger={vurderinger} />
      </Seksjon>

      <Seksjon tittel="Muligheter i porteføljen" undertittel={`${antall(new Set(muligheter.map((m) => m.kundeId)).size, "kunde", "kunder")} med en god grunn til kontakt`}>
        <MuligheterIPorteforljen muligheter={muligheter} kunder={kunder} />
      </Seksjon>

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

      {gronn.size > 0 && (
        <Seksjon tittel="Grønne muligheter" undertittel={antall(gronn.size, "kunde", "kunder")}>
          <GronneMuligheter kunder={kunder} gronn={gronn} />
        </Seksjon>
      )}
    </div>
  );

  const kritiskeKunder = rader.filter((r) => r.v.niva === "Kritisk").map((r) => ({ navn: r.k.navn, dato: r.v.prognose.tomKasseDato }));
  return <PortefoljeModus medAi={medAi} utenAi={<UtenAi kunder={kunder} kritiske={kritiskeKunder} />} />;
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
