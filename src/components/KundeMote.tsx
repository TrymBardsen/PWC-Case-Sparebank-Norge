"use client";

// Kundevisningen: skjermen rådgiveren viser kunden i møtet. Enkelt språk, ett hovedbilde, bare tiltakene
// rådgiveren har valgt på forhånd, og en handlingsplan kunden får med seg. Ingen score, interne vurderinger
// eller andre kunder i banken. Bankens kredittiltak er merket som noe banken må vurdere – ikke et tilbud.

import { useMemo, useState } from "react";
import type { Kunde } from "@/lib/types";
import { lagPrognose, STANDARDVALG, type PrognoseValg } from "@/lib/prognose";
import { tiltakFor, vurderTiltak, type Parametre, type Tiltak } from "@/lib/tiltak";
import { DAGENS_DATO, kortDato, langDato, leggTilDager } from "@/lib/dato";
import { belop, mnok } from "@/lib/format";
import { storsteUtbetalinger } from "@/lib/usikkerhet";
import { loggOppfolging, useLokal } from "@/lib/lokal";
import { PrognoseGraf } from "./PrognoseGraf";
import { lagScenarioer, standardMotetiltak } from "./KundePrognose";

interface Planrad {
  hvem: string;
  hva: string;
  innen: string;
}

const HVEM: Record<Tiltak["aktor"], string> = { Kunden: "Kunden", Banken: "Banken", Skatteetaten: "Kunden (søknad til Skatteetaten)", Eier: "Eier" };

function risikoord(p: number): { ord: string; stil: string } {
  if (p >= 0.5) return { ord: "Høy", stil: "text-red-700" };
  if (p >= 0.2) return { ord: "Middels", stil: "text-amber-700" };
  return { ord: "Lav", stil: "text-emerald-700" };
}

export function KundeMote({ kunde, radgiver, strompris, stromLive }: { kunde: Kunde; radgiver: string; strompris: number; stromLive: boolean }) {
  const standard = useMemo(() => lagPrognose(kunde), [kunde]);
  const standardIds = useMemo(() => standardMotetiltak(kunde), [kunde]);
  const [moteValg, , lastet] = useLokal<string[] | null>(`mote:${kunde.id}`, null);
  const ids = moteValg ?? standardIds;

  const [valgte, setValgte] = useState<string[]>([]);
  const [scenarioPa, setScenarioPa] = useState<string[]>([]);
  const [visScenarioer, setVisScenarioer] = useState(false);
  const [plan, setPlan] = useLokal<Planrad[] | null>(`handlingsplan:${kunde.id}`, null);
  const [kopiert, setKopiert] = useState(false);
  const [lagret, setLagret] = useState(false);

  // Høyst to scenarioer i møtet: største kunde betaler senere og omsetningsfall
  const scenarioer = useMemo(
    () => lagScenarioer(kunde, standard, {} as Parametre, strompris, stromLive).filter((s) => s.id === "storsteKundeForsinkelse" || s.id === "omsetningsfall").slice(0, 2),
    [kunde, standard, strompris, stromLive],
  );
  const scenario = useMemo(
    () => scenarioer.filter((s) => scenarioPa.includes(s.id)).reduce<PrognoseValg>((v, s) => ({ ...v, [s.id]: s.tilValg(s.parameter.verdi) }), STANDARDVALG),
    [scenarioer, scenarioPa],
  );
  const vurdering = useMemo(() => vurderTiltak(kunde, scenario), [kunde, scenario]);
  // Bare tiltakene rådgiveren har valgt, og bare de som faktisk har effekt
  const tiltak = useMemo(
    () => tiltakFor(kunde).filter((t) => ids.includes(t.id) && !t.utilgjengelig && (vurdering.effekter.find((e) => e.tiltak.id === t.id)?.forbedring ?? 0) > 0),
    [kunde, ids, vurdering],
  );
  const aktive = tiltak.filter((t) => valgte.includes(t.id));
  const valg = aktive.reduce<PrognoseValg>((v, t) => ({ ...v, ...t.valg }), scenario);
  const prognose = useMemo(() => (aktive.length ? lagPrognose(kunde, valg) : vurdering.basis), [kunde, valg, aktive.length, vurdering.basis]);
  const uten = vurdering.basis;
  const risiko = risikoord(prognose.sannsynlighetInsolvens);
  const kommende = useMemo(() => storsteUtbetalinger(standard, 5), [standard]);

  const forslagPlan: Planrad[] = (aktive.length ? aktive : tiltak).map((t) => ({
    hvem: t.aktor === "Banken" ? `Banken (${radgiver})` : HVEM[t.aktor],
    hva: t.aktor === "Banken" ? `${t.navn} – banken vurderer og gir svar` : t.navn,
    innen: leggTilDager(DAGENS_DATO, t.aktor === "Kunden" ? 7 : 14),
  }));
  const rader = plan ?? forslagPlan;
  const settRad = (i: number, del: Partial<Planrad>) => setPlan(rader.map((r, j) => (j === i ? { ...r, ...del } : r)));
  const planTekst = [
    `Handlingsplan for ${kunde.navn} – ${langDato(DAGENS_DATO)}`,
    "",
    ...rader.filter((r) => r.hva.trim()).map((r) => `• ${r.hva} – ${r.hvem}, innen ${langDato(r.innen)}`),
    "",
    `Vi følger opp sammen. Vennlig hilsen ${radgiver}, Sparebanken Norge`,
  ].join("\n");

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="overtittel mb-1">De neste 13 ukene</div>
        <h2 className="font-overskrift text-2xl font-bold text-slate-900 md:text-3xl">
          {prognose.tomKasseDato ? `Rundt ${kortDato(prognose.tomKasseDato)} blir det trangt` : "Kassekreditten ser ut til å strekke til"}
        </h2>
        <p className="mt-2 max-w-3xl text-[15px] text-slate-700">
          {prognose.tomKasseDato
            ? `Uten endringer kan saldoen gå under kassekredittrammen på ${mnok(kunde.kassekredittRamme)}. Det henger mest sammen med store faste utbetalinger som lønn, skattetrekk og MVA.`
            : "Saldoen holder seg innenfor kassekredittrammen i det forventede forløpet, men store utbetalinger gjør enkelte uker stramme."}
          {aktive.length > 0 && ` Med tiltakene dere ser på: ${prognose.tomKasseDato ? `fortsatt trangt rundt ${kortDato(prognose.tomKasseDato)}` : "rammen strekker til"}.`}
        </p>
        <p className="mt-3 text-sm">
          Risiko for at det blir for trangt: <b className={risiko.stil}>{risiko.ord}</b>
          {aktive.length > 0 && <span className="text-slate-500"> (uten tiltak: {risikoord(uten.sannsynlighetInsolvens).ord.toLowerCase()})</span>}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="overtittel mb-1">Saldo på driftskonto inkludert kassekreditt</div>
        <PrognoseGraf historikk={kunde.dagligSaldo} prognose={prognose} sammenlign={aktive.length ? uten : undefined} sammenlignNavn="Uten tiltak" grenseNavn="Kassekredittramme" />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Mørk strek: saldo så langt</span>
          <span>Grønn: forventet saldo{aktive.length ? " med tiltak" : ""}</span>
          {aktive.length > 0 && <span>Stiplet: uten tiltak</span>}
          <span>Rødt felt: under kassekredittrammen</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="font-overskrift text-lg font-bold text-snb-rod">Store utbetalinger som kommer</h3>
          <ul className="mt-3 divide-y divide-slate-100 text-[15px]">
            {kommende.map((p) => (
              <li key={p.dato + p.navn} className="flex items-center justify-between gap-4 py-2.5">
                <span>
                  <span className="block font-medium text-slate-900">{p.navn}</span>
                  <span className="text-sm text-slate-500">{langDato(p.dato)}</span>
                </span>
                <span className="tall font-semibold text-slate-900">{belop(p.belop)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 print:hidden">
          <h3 className="font-overskrift text-lg font-bold text-snb-rod">Tiltak vi kan se på sammen</h3>
          {!lastet ? null : tiltak.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Ingen tiltak er valgt for møtet. Rådgiveren velger dem under «Tiltak» på kundesiden.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {tiltak.map((t) => {
                const pa = valgte.includes(t.id);
                const effekt = vurdering.effekter.find((e) => e.tiltak.id === t.id)?.forbedring ?? 0;
                return (
                  <button
                    key={t.id}
                    aria-pressed={pa}
                    onClick={() => setValgte((v) => (pa ? v.filter((x) => x !== t.id) : [...v, t.id]))}
                    className={`flex min-h-14 w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${pa ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <span className={`mt-1 h-5 w-5 shrink-0 rounded border-2 ${pa ? "border-teal-600 bg-teal-600" : "border-slate-300"}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-900">{t.navn}</span>
                      <span className="block text-sm text-slate-600">{t.beskrivelse}</span>
                      {t.aktor === "Banken" && <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">Må vurderes av banken</span>}
                    </span>
                    <span className="tall shrink-0 text-sm font-semibold text-teal-700">+{belop(effekt)}</span>
                  </button>
                );
              })}
              <p className="text-xs text-slate-500">Tallet viser hvor mye mer det er å gå på når det er som trangest.</p>
            </div>
          )}

          {scenarioer.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button onClick={() => setVisScenarioer((v) => !v)} className="text-sm font-semibold text-snb-rod hover:underline">
                {visScenarioer ? "Skjul «hva om»" : "Hva om …?"}
              </button>
              {visScenarioer && (
                <div className="mt-2 space-y-2">
                  {scenarioer.map((s) => {
                    const pa = scenarioPa.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        aria-pressed={pa}
                        onClick={() => setScenarioPa((v) => (pa ? v.filter((x) => x !== s.id) : [...v, s.id]))}
                        className={`block min-h-12 w-full rounded-lg border px-4 py-2.5 text-left text-sm ${pa ? "border-amber-500 bg-amber-50" : "border-slate-200"}`}
                      >
                        <span className="font-medium text-slate-900">{s.tittel}</span>
                        <span className="block text-slate-600">{s.beskrivelse}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border-2 border-snb-gronn bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-overskrift text-lg font-bold text-snb-gronn">Handlingsplan</h3>
          <span className="flex flex-wrap gap-2 print:hidden">
            <button onClick={() => window.print()} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-400">
              Skriv ut / lagre som PDF
            </button>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(planTekst);
                setKopiert(true);
                setTimeout(() => setKopiert(false), 2500);
              }}
              className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              {kopiert ? "Kopiert" : "Kopier som e-post"}
            </button>
            <button
              onClick={() => {
                loggOppfolging(kunde.id, radgiver, planTekst.split("\n").slice(2, -2).join(" "), "Handlingsplan avtalt");
                setLagret(true);
              }}
              className="min-h-10 rounded-md bg-snb-gronn px-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {lagret ? "Lagret i kundeloggen" : "Lagre i kundeloggen"}
            </button>
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">Hvem gjør hva, og når. Fyll inn sammen med kunden.</p>
        <div className="mt-3 space-y-2">
          {rader.map((r, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_10rem_auto]">
              <input value={r.hva} onChange={(e) => settRad(i, { hva: e.target.value })} placeholder="Hva" aria-label="Hva" className="min-h-10 rounded-md border border-slate-300 bg-white px-2 text-sm" />
              <input value={r.hvem} onChange={(e) => settRad(i, { hvem: e.target.value })} placeholder="Hvem" aria-label="Hvem" className="min-h-10 rounded-md border border-slate-300 bg-white px-2 text-sm" />
              <input type="date" value={r.innen} onChange={(e) => settRad(i, { innen: e.target.value })} aria-label="Innen" className="min-h-10 rounded-md border border-slate-300 bg-white px-2 text-sm" />
              <button onClick={() => setPlan(rader.filter((_, j) => j !== i))} className="min-h-10 px-2 text-sm text-slate-500 hover:text-snb-rod print:hidden" aria-label="Fjern punkt">
                Fjern
              </button>
            </div>
          ))}
          <button
            onClick={() => setPlan([...rader, { hvem: "Kunden", hva: "", innen: leggTilDager(DAGENS_DATO, 7) }])}
            className="min-h-10 text-sm font-semibold text-snb-rod hover:underline print:hidden"
          >
            + Legg til punkt
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Tallene er anslag basert på kontoen og betalingene i banken. Bankens tiltak krever en egen vurdering før de kan avtales.</p>
      </section>
    </div>
  );
}
