import Link from "next/link";
import { notFound } from "next/navigation";
import { hentKunde, hentVurderinger, portefolje } from "@/lib/data";
import { hentMakro } from "@/lib/makro";
import { DAGENS_DATO, dagerMellom, dagerSiden, kortDato, visDatoer } from "@/lib/dato";
import { antall, belop, krPresis, liten, mnok, prosent } from "@/lib/format";
import { KildeTag, Kort, SamtykkeMerke, ScoreMerke, Utnyttelse } from "@/components/ui";
import { KundePrognose } from "@/components/KundePrognose";
import { AiBrief } from "@/components/AiBrief";
import { Oppfolging } from "@/components/Oppfolging";
import { TekstSignaler } from "@/components/TekstSignaler";
import { alleTekster } from "@/lib/tekst";
import { ScoreForklaring } from "@/components/ScoreForklaring";
import { KundeFaner, TilFane } from "@/components/KundeFaner";
import { KundeMuligheter } from "@/components/Muligheter";
import { muligheterFor } from "@/lib/muligheter";
import { Minigraf } from "@/components/Minigraf";
import { usikkerheterFor } from "@/lib/usikkerhet";
import { valgtRadgiver } from "@/lib/radgiver";
import { vurderTiltak } from "@/lib/tiltak";
import { nesteHandling, type NesteHandling } from "@/lib/neste";
import { BeOmTilgang, DelKunde, Kreditsaker, SendTilKreditt, SidenSist, type KredittUtkast } from "@/components/Kundehandlinger";
import type { Vurdering } from "@/lib/score";
import type { Kunde } from "@/lib/types";

// Dynamisk, så lagrede tekstanalyser slår inn i scoren med en gang
export const dynamic = "force-dynamic";

// Gamle lenker til «Forbered samtale» og «Oppfølging» går til den sammenslåtte fanen «Samtale»
const GAMLE_FANER: Record<string, string> = { oppfolging: "samtale" };

export default async function Kundeside({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fane?: string }> }) {
  const { id } = await params;
  const { fane } = await searchParams;
  const kunde = hentKunde(id);
  if (!kunde) notFound();

  const { vurderinger, smitte } = hentVurderinger();
  const v = vurderinger.get(kunde.id)!;
  const makro = await hentMakro();
  const innlogget = await valgtRadgiver();
  const tv = vurderTiltak(kunde);
  const neste = nesteHandling(kunde, v, tv);
  const usikkerheter = usikkerheterFor(kunde, v.prognose, v.tekstanalyse);
  const navn = (kid: string) => portefolje.kunder.find((k) => k.id === kid)!.navn;
  const eksponerte = smitte.filter((s) => s.fra === kunde.id);
  const avhengigAv = smitte.filter((s) => s.til === kunde.id);
  const kreditt = kredittUtkast(kunde, v, tv);
  const lanSum = kunde.lan.reduce((s, l) => s + l.saldo, 0);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="overtittel">Kundeanalyse</div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <h1 className="font-overskrift text-3xl font-bold text-snb-rod">{kunde.navn}</h1>
              <ScoreMerke score={v.score} niva={v.niva} stor />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {kunde.bransje} · {kunde.ansatte} ansatte · {kunde.adresse} · daglig leder {kunde.dagligLeder} · rådgiver {kunde.radgiver}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DelKunde kundeId={kunde.id} kundenavn={kunde.navn} fra={innlogget} kolleger={portefolje.radgivere} />
            <Link
              href={`/kunde/${kunde.id}/kundevisning`}
              className="rounded-md bg-snb-rod px-3 py-1.5 text-xs font-semibold text-white hover:bg-snb-rod-mork"
            >
              Start kundemøte →
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-700">
          <span className="flex items-center gap-2">
            Kassekreditt <b>{mnok(kunde.kassekredittRamme)}</b> <Utnyttelse andel={v.kkUtnyttelse} />
          </span>
          <span>
            Lån <b>{mnok(lanSum)}</b>
          </span>
          <span>
            Sikkerheter <b>{mnok(kunde.sikkerheter)}</b>
          </span>
          <span>
            Siste kontakt <b>{kunde.sisteKontakt ? `${dagerSiden(kunde.sisteKontakt)} dager siden` : "ingen registrert"}</b>
          </span>
          <SamtykkeMerke niva={kunde.samtykke} />
        </div>
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-600 hover:text-snb-rod">Flere detaljer</summary>
          <p className="mt-1">
            Org.nr. {kunde.orgnr} (fiktivt) · {kunde.naceKode} · {kunde.segment} · {kunde.eierstruktur.toLowerCase()} · etablert {kunde.etablert} · kunde siden {kunde.kundeSiden} ·
            risikoklasse {kunde.risikoklasse}
          </p>
          <p>
            Omsetning {kunde.regnskapIFjor.omsetning.map((o) => `${o.aar}: ${mnok(o.belop)}`).join(" · ")} · driftsresultat 2025 {mnok(kunde.regnskapIFjor.driftsresultat)} ·
            egenkapitalandel {prosent(kunde.regnskapIFjor.egenkapitalAndel)}
          </p>
        </details>
        <SidenSist
          kundeId={kunde.id}
          naa={{ dato: DAGENS_DATO, score: v.score, niva: v.niva, tom: v.prognose.tomKasseDato, sannsynlighet: v.prognose.sannsynlighetInsolvens, kk: v.kkUtnyttelse }}
        />
      </div>

      {kunde.sensitiv && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
          <div className="font-semibold">Sensitiv situasjon – vær varsom med kontakt</div>
          <p className="mt-0.5">{visDatoer(kunde.sensitiv)}</p>
          <p className="mt-1 text-xs text-violet-800">Kunden er tatt ut av dagens agenda. Bruk tallene under som bakgrunn, men respekter det som er avtalt om kontakt.</p>
        </div>
      )}

      <KundeFaner
        start={fane ? (GAMLE_FANER[fane] ?? fane) : "oversikt"}
        faner={[
          {
            id: "oversikt",
            navn: "Oversikt",
            innhold: (
              <div className="space-y-5">
                <Konklusjon kunde={kunde} v={v} />
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                  <div className="space-y-5 xl:col-span-2">
                    <NesteHandlingKort neste={neste} kunde={kunde} innlogget={innlogget} kreditt={kreditt} />
                    <Drivere v={v} />
                    <Kort
                      overtittel="Saldo inkl. trekkramme · 90 dager + 13 uker"
                      tittel="Likviditet"
                      hoyre={
                        <TilFane id="tiltak" className="text-sm font-semibold text-snb-rod hover:underline">
                          Se hele prognosen og tiltak →
                        </TilFane>
                      }
                    >
                      <Minigraf historikk={kunde.dagligSaldo} prognose={v.prognose} bredde={640} hoyde={110} />
                      <p className="mt-2 text-xs text-slate-500">Grå strek er faktisk saldo, prognosen er rød når den passerer insolvensgrensen (stiplet).</p>
                    </Kort>
                  </div>
                  <div className="space-y-5">
                    <Kort overtittel="Undersøk i samtalen" tittel="Spørsmål til kunden">
                      <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-800">
                        {usikkerheter
                          .filter((u) => u.sporsmal)
                          .map((u) => (
                            <li key={u.tema + u.sporsmal}>{u.sporsmal}</li>
                          ))}
                      </ul>
                      <TilFane id="detaljer" className="mt-3 text-xs font-semibold text-snb-rod hover:underline">
                        Hva vi ikke vet, og hvorfor →
                      </TilFane>
                    </Kort>
                    <KundeMuligheter muligheter={muligheterFor(kunde, v)} />
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "tiltak",
            navn: "Tiltak",
            innhold: <KundePrognose kunde={kunde} strompris={makro.stromNO5} stromLive={makro.live.strom} radgiver={innlogget} kreditt={kreditt} />,
          },
          {
            id: "samtale",
            navn: "Samtale",
            innhold: (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Kort overtittel="Før møtet" tittel="Møterapport med KI">
                    <p className="text-sm text-slate-600">
                      Én side med det viktigste å vite før møtet: situasjon, risikoer, bransje og marked, spørsmål og tiltak. Hvert punkt har kildehenvisning og
                      kontrolleres mot bankens data.
                    </p>
                    <Link
                      href={`/kunde/${kunde.id}/rapport`}
                      className="mt-4 inline-flex items-center gap-2 rounded-md bg-snb-rod px-4 py-2 text-sm font-semibold text-white hover:bg-snb-rod-mork"
                    >
                      Lag møterapport →
                    </Link>
                  </Kort>
                  <Kort overtittel="I møtet" tittel="Kundevisning">
                    <p className="text-sm text-slate-600">
                      Vis prognosen og de tiltakene du har valgt under «Tiltak» til kunden, og lag en handlingsplan sammen. Kundevisningen har ingen risikoscore, interne
                      vurderinger eller andre kunder i banken.
                    </p>
                    <Link
                      href={`/kunde/${kunde.id}/kundevisning`}
                      className="mt-4 inline-flex items-center gap-2 rounded-md border border-snb-rod px-4 py-2 text-sm font-semibold text-snb-rod hover:bg-snb-rod-lys"
                    >
                      Start kundemøte →
                    </Link>
                  </Kort>
                </div>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <AiBrief kundeId={kunde.id} radgiver={innlogget} />
                  <Oppfolging kundeId={kunde.id} notater={kunde.notater} radgiver={innlogget} />
                </div>
                <TekstSignaler kundeId={kunde.id} kilder={alleTekster(kunde)} analyse={v.tekstanalyse} debitorer={kunde.debitorer} />
              </div>
            ),
          },
          {
            id: "detaljer",
            navn: "Detaljer",
            innhold: (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="space-y-6">
                  <Kort overtittel="Forklarbar score" tittel="Alle signaler bak varselet">
                    <ScoreForklaring faktorer={v.faktorer} score={v.score} niva={v.niva} />
                  </Kort>
                  <Kort overtittel="Antakelser og manglende data" tittel="Dette vet vi ikke">
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {usikkerheter.map((u) => (
                        <li key={u.tema + u.tekst}>
                          <span className="font-medium text-slate-900">{u.tema}:</span> {u.tekst}
                        </li>
                      ))}
                    </ul>
                  </Kort>
                </div>
                <div className="space-y-6">
                  <Kort overtittel="Personvern" tittel="Datagrunnlag og samtykke" hoyre={<SamtykkeMerke niva={kunde.samtykke} />}>
                    <ul className="space-y-2 text-sm">
                      <Datanivå pa tittel="1 · Bankdata og offentlige data" tekst="Konto og transaksjoner, kassekreditt, lån, sikkerheter, avviste betalinger, registerhendelser og SSB." />
                      <Datanivå
                        pa={kunde.samtykke >= 2}
                        tittel="2 · Regnskapssystem"
                        tekst={
                          kunde.samtykke >= 2
                            ? `Reskontro og forfalt leverandørgjeld fra ${kunde.regnskapssystem ?? "regnskapssystemet"}.`
                            : "Uten reskontro er prognosen bredere og vi ser ikke hvem som skylder penger."
                        }
                      />
                      <Datanivå pa={kunde.samtykke >= 3} tittel="3 · Eierens privatøkonomi" tekst="Finnes ikke i datagrunnlaget (krever eget samtykke)." />
                    </ul>
                    {kunde.samtykke < 2 && <BeOmTilgang kundeId={kunde.id} dagligLeder={kunde.dagligLeder} radgiver={innlogget} />}
                    <p className="mt-3 text-[11px] text-slate-500">Samtykkenivåene er illustrert. Prototypen har ingen ekte samtykke- eller tilgangskontroll.</p>
                  </Kort>
                  <Kort overtittel="Saksbehandling" tittel="Kredittsaker">
                    <Kreditsaker kundeId={kunde.id} />
                  </Kort>
                  {kunde.fakturaer && kunde.fakturaer.length > 0 && (
                    <Kort overtittel="Regnskapssystem" tittel="Utestående fakturaer" hoyre={<KildeTag kilde="Regnskapssystem" />}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                            <th className="py-1.5">Kunde</th>
                            <th>Forfall</th>
                            <th className="text-right">Dager over forfall</th>
                            <th className="text-right">Beløp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...kunde.fakturaer]
                            .sort((a, b) => a.forfall.localeCompare(b.forfall))
                            .map((f) => {
                              const over = dagerMellom(f.forfall, DAGENS_DATO);
                              return (
                                <tr key={f.id} className="tall border-b border-slate-100 last:border-0">
                                  <td className="py-1.5">{f.debitor}</td>
                                  <td>{kortDato(f.forfall)}</td>
                                  <td className={`text-right ${over > 30 ? "font-semibold text-red-600" : over > 0 ? "text-orange-600" : "text-slate-400"}`}>{over > 0 ? over : "–"}</td>
                                  <td className="text-right">{krPresis(f.belop)}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </Kort>
                  )}
                  {(eksponerte.length > 0 || avhengigAv.length > 0) && (
                    <Kort overtittel="Verdikjede" tittel="Nettverk i porteføljen" hoyre={<KildeTag kilde="Bankdata" />}>
                      <ul className="space-y-2 text-sm">
                        {eksponerte.map((s) => (
                          <li key={s.til}>
                            <Link href={`/kunde/${s.til}`} className="font-semibold text-snb-rod hover:underline">
                              {navn(s.til)}
                            </Link>{" "}
                            får {prosent(s.andel)} av innbetalingene sine herfra.
                          </li>
                        ))}
                        {avhengigAv.map((s) => (
                          <li key={s.fra}>
                            {prosent(s.andel)} av innbetalingene kommer fra{" "}
                            <Link href={`/kunde/${s.fra}`} className="font-semibold text-snb-rod hover:underline">
                              {navn(s.fra)}
                            </Link>
                            .
                          </li>
                        ))}
                      </ul>
                    </Kort>
                  )}
                  <Kort overtittel="Betalere" tittel="Kundens kunder" hoyre={<KildeTag kilde="Bankdata" />}>
                    <ul className="space-y-1.5 text-sm">
                      {kunde.debitorer.map((d) => (
                        <li key={d.navn} className="flex items-center justify-between gap-2">
                          <span>{d.navn}</span>
                          <span className="tall text-xs text-slate-500">
                            {prosent(d.andelAvInnbetalinger)} ·{" "}
                            {d.snittDagerForsinkelse === undefined ? (
                              <span>forsinkelse ukjent</span>
                            ) : (
                              <span className={d.snittDagerForsinkelse > 20 ? "font-medium text-red-600" : ""}>{d.snittDagerForsinkelse} d forsinket</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Kort>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

// Forhåndsutfylt kredittsak for bankens tiltak i den anbefalte pakken
function kredittUtkast(kunde: Kunde, v: Vurdering, tv: ReturnType<typeof vurderTiltak>): KredittUtkast | null {
  const bank = (tv.pakke?.tiltak ?? []).filter((t) => t.aktor === "Banken");
  if (!bank.length || kunde.sensitiv) return null;
  const p = v.prognose;
  const effekt = tv.pakke!.prognose;
  return {
    tiltak: bank.map((t) => ({ navn: t.navn, betalingslettelse: t.betalingslettelse })),
    tekst: [
      `Kunde: ${kunde.navn} (org.nr. ${kunde.orgnr}), ${kunde.bransje}. Rådgiver: ${kunde.radgiver}.`,
      `Situasjon: ${p.tomKasseDato ? `insolvensgrensen passeres ${kortDato(p.tomKasseDato)} i forventet forløp, ${antall(p.dagerUnderGrensen, "dag", "dager")} under grensen` : "holder seg innenfor rammen i forventet forløp"}. Modellsannsynlighet ${prosent(p.sannsynlighetInsolvens)}. Laveste saldo ${belop(p.lavesteSaldo)}.`,
      `Engasjement: kassekreditt ${mnok(kunde.kassekredittRamme)}, lån ${mnok(kunde.lan.reduce((s, l) => s + l.saldo, 0))}, sikkerheter ${mnok(kunde.sikkerheter)}.`,
      `Søknad: ${bank.map((t) => `${t.navn} (${t.beskrivelse})`).join("; ")}.`,
      `Effekt av anbefalt pakke (${tv.pakke!.tiltak.map((t) => liten(t.navn)).join(" + ")}): margin ${belop(effekt.margin)} på det laveste, modellsannsynlighet ${prosent(effekt.sannsynlighetInsolvens)}.`,
      bank.some((t) => t.betalingslettelse) ? "Betalingslettelse: ja – må merkes og rapporteres." : "Betalingslettelse: nei.",
      "Rådgivers vurdering: [fyll inn]",
    ].join("\n"),
  };
}

function Datanivå({ pa, tittel, tekst }: { pa: boolean; tittel: string; tekst: string }) {
  return (
    <li className="flex gap-2">
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] text-white ${pa ? "bg-teal-600" : "bg-slate-300"}`}>{pa ? "✓" : ""}</span>
      <span>
        <span className={`block font-medium ${pa ? "text-slate-900" : "text-slate-500"}`}>{tittel}</span>
        <span className="block text-xs text-slate-500">{tekst}</span>
      </span>
    </li>
  );
}

const HANDLING: Record<Vurdering["niva"], { tittel: string; tekst: string }> = {
  Kritisk: { tittel: "Ta kontakt i dag", tekst: "Kunden er i ferd med å gå tom. Banken kan fortsatt skape handlingsrom." },
  Høy: { tittel: "Ta kontakt denne uken", tekst: "Banken kan skape handlingsrom før dette blir et problem." },
  "Følg med": { tittel: "Følg med", tekst: "Ingen akutt fare, men signalene bør følges de neste ukene." },
  Lav: { tittel: "Ingen handling nå", tekst: "Ingen tegn til likviditetsskvis i datagrunnlaget." },
};

// Konklusjonen øverst i Oversikt: hva prognosen sier, og hvor raskt rådgiveren bør handle
function Konklusjon({ kunde, v }: { kunde: Kunde; v: Vurdering }) {
  const p = v.prognose;
  const overskrift = p.tomKasseDato
    ? `Kassekreditten strekker ikke til ${kortDato(p.tomKasseDato)}`
    : p.sannsynlighetInsolvens >= 0.1
      ? "Holder i forventet forløp, men med betydelig usikkerhet"
      : "Likviditeten ser ut til å holde de neste 13 ukene";
  const handling = kunde.sensitiv ? { tittel: "Vær varsom med kontakt", tekst: "Sensitiv situasjon. Bruk tallene som bakgrunn og respekter det som er avtalt." } : HANDLING[v.niva];
  const kritisk = !kunde.sensitiv && (v.niva === "Kritisk" || v.niva === "Høy");
  return (
    <section className="grid grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="p-5">
        <div className="overtittel mb-1">Konklusjon</div>
        <h2 className="font-overskrift text-2xl leading-snug font-bold text-slate-900">{overskrift}</h2>
        <p className="mt-2 text-[15px] text-slate-700">
          {p.tomKasseDato ? `${p.dagerUnderGrensen} av de neste 91 dagene er under grensen i forventet forløp. ` : ""}
          Laveste saldo er {belop(p.lavesteSaldo)} {kortDato(p.lavesteDato)}, {belop(Math.abs(p.margin))} {p.margin < 0 ? "under" : "over"} insolvensgrensen på{" "}
          {mnok(-p.ramme)}.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Modellsannsynlighet for å passere grensen: {prosent(p.sannsynlighetInsolvens)}. Det er et anslag fra prognosen, ikke en kalibrert sannsynlighet.
        </p>
      </div>
      <div className={`flex flex-col justify-center gap-1 p-5 ${kritisk ? "bg-snb-rod-lys" : "bg-snb-gronn-lys"}`}>
        <div className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">Hastegrad</div>
        <div className={`font-overskrift text-xl font-bold ${kritisk ? "text-snb-rod" : "text-snb-gronn"}`}>{handling.tittel}</div>
        <p className="text-sm text-slate-700">{handling.tekst}</p>
      </div>
    </section>
  );
}

// Neste beste handling: ett forslag med ansvarlig og frist
function NesteHandlingKort({ neste, kunde, innlogget, kreditt }: { neste: NesteHandling; kunde: Kunde; innlogget: string; kreditt: KredittUtkast | null }) {
  return (
    <section className="rounded-lg border-2 border-snb-gronn bg-white p-5">
      <div className="overtittel mb-1">Neste beste handling</div>
      <h2 className="font-overskrift text-xl font-bold text-slate-900">{neste.tittel}</h2>
      <p className="mt-1 text-sm text-slate-700">{neste.hvorfor}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Ansvarlig</dt>
          <dd className="font-medium">{neste.ansvarlig}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Frist</dt>
          <dd className={`font-medium ${neste.frist === "I dag" ? "text-red-600" : ""}`}>{neste.frist}</dd>
        </div>
        {neste.flere.length > 0 && (
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs text-slate-500">Deretter</dt>
            <dd className="font-medium">{neste.flere.map((t) => t.navn).join(", ")}</dd>
          </div>
        )}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <TilFane id="tiltak" className="rounded-md bg-snb-rod px-3 py-1.5 text-xs font-semibold text-white hover:bg-snb-rod-mork">
          Se tiltaket i prognosen →
        </TilFane>
        {kreditt && <SendTilKreditt kundeId={kunde.id} kundenavn={kunde.navn} radgiver={innlogget} utkast={kreditt} liten />}
      </div>
    </section>
  );
}

// De tre signalene som trekker scoren mest, med kilde
function Drivere({ v }: { v: Vurdering }) {
  const topp = v.faktorer.filter((f) => f.poeng > 0 && !f.ukjent).sort((a, b) => b.poeng - a.poeng).slice(0, 3);
  if (!topp.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {topp.map((f) => (
        <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="tall text-xs font-semibold text-snb-rod">+{f.poeng} poeng</div>
          <div className="mt-0.5 font-overskrift text-base font-bold text-slate-900">{f.navn}</div>
          <p className="mt-1 text-sm text-slate-600">{visDatoer(f.forklaring)}</p>
          <p className="mt-2 text-xs text-slate-500">Kilde: {f.kilde.toLowerCase()}</p>
        </div>
      ))}
    </div>
  );
}
