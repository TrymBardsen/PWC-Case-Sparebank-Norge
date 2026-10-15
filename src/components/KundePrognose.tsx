"use client";

import { useEffect, useMemo, useState } from "react";
import type { Kunde } from "@/lib/types";
import { lagPrognose, oppsummerPoster, STANDARDVALG, type PrognoseValg } from "@/lib/prognose";
import { tiltakFor, vurderTiltak, type Parameter, type Parametre, type Tiltak } from "@/lib/tiltak";
import { kortDato } from "@/lib/dato";
import { kr, mnok, omUker, prosent, tusen } from "@/lib/format";
import { PrognoseGraf, Risikostripe } from "./PrognoseGraf";
import { TiltakGraf, type TiltakRad } from "./TiltakGraf";
import { Kort } from "./ui";
import { GronnKort } from "./GronnKort";
import { vurderGronn } from "@/lib/gronn";

interface Scenario {
  id: keyof PrognoseValg;
  tittel: string;
  beskrivelse: string;
  parameter: Parameter;
  tilValg: (verdi: number) => number;
}

// mote: visning for kunden i møtet. Ingen interne vurderinger (anbefalt pakke, betalingslettelse,
// bankens forbehold) og nøytrale ord («kassekredittrammen» i stedet for «insolvensgrensen»).
export function KundePrognose({ kunde, strompris, mote = false }: { kunde: Kunde; strompris: number; mote?: boolean }) {
  const [scenarioPa, setScenarioPa] = useState<string[]>([]);
  const [scenarioVerdier, setScenarioVerdier] = useState<Parametre>({});
  const [parametre, setParametre] = useState<Parametre>({});
  const [valgte, setValgte] = useState<string[]>([]);
  const [apenUke, setApenUke] = useState<number | null>(null);
  const [visMetode, setVisMetode] = useState(false);

  const standard = useMemo(() => lagPrognose(kunde), [kunde]);

  // Kort- og kontantsalg kan ikke «betale senere», så scenarioet gir bare mening for fakturakunder
  const storsteErFakturakunde = !kunde.debitorer.some((d) => d.navn === standard.storsteDebitor && (d.type === "Kortoppgjer" || d.type === "Privat" || (d.snittDagerForsinkelse ?? 99) <= 2) && d.andelAvInnbetalinger >= 0.6);
  const sv = (id: string, standardverdi: number, min: number, maks: number) => {
    const v = scenarioVerdier[id];
    return v === undefined || !Number.isFinite(v) ? standardverdi : Math.min(maks, Math.max(min, v));
  };
  const vForsinkelse = sv("storsteKundeForsinkelse", 30, 5, 120);
  const vRente = sv("renteTillegg", 1, -3, 10);
  const vOmsetning = sv("omsetningsfall", 20, 5, 80);
  const vStrom = sv("stromFaktor", 50, -50, 300);
  const alleScenarioer: Scenario[] = [
    {
      id: "storsteKundeForsinkelse",
      tittel: `${standard.storsteDebitor} betaler ${vForsinkelse} dager senere`,
      beskrivelse: `Største kunde, ${prosent(standard.storsteDebitorAndel)} av innbetalingene`,
      parameter: { etikett: "Forsinkelse", enhet: "dager", standard: 30, min: 5, maks: 120, steg: 5, verdi: vForsinkelse },
      tilValg: (v) => v,
    },
    {
      id: "renteTillegg",
      tittel: `Renten ${vRente >= 0 ? "øker" : "faller"} ${String(Math.abs(vRente)).replace(".", ",")} prosentpoeng`,
      beskrivelse: "På lån og kassekreditt",
      parameter: { etikett: "Endring", enhet: "pp", standard: 1, min: -3, maks: 10, steg: 0.25, verdi: vRente },
      tilValg: (v) => v / 100,
    },
    {
      id: "omsetningsfall",
      tittel: `Omsetningen faller ${vOmsetning} %`,
      beskrivelse: "Variable kostnader faller bare halvparten",
      parameter: { etikett: "Fall", enhet: "%", standard: 20, min: 5, maks: 80, steg: 5, verdi: vOmsetning },
      tilValg: (v) => v / 100,
    },
    {
      id: "stromFaktor",
      tittel: `Strømprisen ${vStrom >= 0 ? "øker" : "faller"} ${Math.abs(vStrom)} %`,
      beskrivelse: `Strøm koster kunden ca. ${kr(kunde.faste.stromPerMnd)} i måneden (spotpris NO5 i dag ${strompris.toFixed(2).replace(".", ",")} kr/kWh)`,
      parameter: { etikett: "Endring", enhet: "%", standard: 50, min: -50, maks: 300, steg: 10, verdi: vStrom },
      tilValg: (v) => 1 + v / 100,
    },
  ];
  const scenarioer = alleScenarioer.filter((s) => s.id !== "storsteKundeForsinkelse" || storsteErFakturakunde);

  const scenarioNokkel = JSON.stringify(
    scenarioer.filter((x) => scenarioPa.includes(x.id)).reduce<PrognoseValg>((v, x) => ({ ...v, [x.id]: x.tilValg(x.parameter.verdi) }), STANDARDVALG),
  );
  const scenario = useMemo(() => JSON.parse(scenarioNokkel) as PrognoseValg, [scenarioNokkel]);
  const parameterNokkel = JSON.stringify(parametre);

  // Tiltak uten data (f.eks. energitiltak som ikke er kartlagt) vises ikke
  const alleTiltak = useMemo(() => tiltakFor(kunde, JSON.parse(parameterNokkel)).filter((t) => t.id !== "energitiltak" || !t.utilgjengelig), [kunde, parameterNokkel]);
  const vurdering = useMemo(() => vurderTiltak(kunde, scenario, JSON.parse(parameterNokkel)), [kunde, scenario, parameterNokkel]);
  const aktiveTiltak = alleTiltak.filter((t) => valgte.includes(t.id));
  const valg = aktiveTiltak.reduce<PrognoseValg>((v, t) => ({ ...v, ...t.valg }), scenario);
  const valgNokkel = JSON.stringify(valg);
  const prognose = useMemo(
    () => (aktiveTiltak.length ? lagPrognose(kunde, JSON.parse(valgNokkel) as PrognoseValg) : vurdering.basis),
    [kunde, valgNokkel, aktiveTiltak.length, vurdering.basis],
  );

  const scenarioAktiv = scenarioNokkel !== JSON.stringify(STANDARDVALG);
  const sammenlign = aktiveTiltak.length ? vurdering.basis : scenarioAktiv ? standard : undefined;
  const sammenlignNavn = aktiveTiltak.length ? (scenarioAktiv ? "Scenario uten tiltak" : "Uten tiltak") : "Uten scenario";

  const veksleScenario = (id: string) => setScenarioPa((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  const veksleTiltak = (id: string) => setValgte((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  const effektFor = (id: string) => vurdering.effekter.find((e) => e.tiltak.id === id);

  const pakke = vurdering.pakke;
  const pakkeErValgt = Boolean(pakke && pakke.tiltak.length === valgte.length && pakke.tiltak.every((t) => valgte.includes(t.id)));

  const rader: TiltakRad[] = [
    { navn: scenarioAktiv ? "Scenario uten tiltak" : "Uten tiltak", margin: vurdering.basis.margin, sannsynlighet: vurdering.basis.sannsynlighetInsolvens, type: "basis" },
    ...[...vurdering.effekter]
      .sort((a, b) => b.prognose.margin - a.prognose.margin)
      .map((e): TiltakRad => ({ navn: e.tiltak.navn, margin: e.prognose.margin, sannsynlighet: e.prognose.sannsynlighetInsolvens, type: "tiltak" })),
    ...(aktiveTiltak.length > 1 && !pakkeErValgt
      ? [{ navn: "Din kombinasjon", margin: prognose.margin, sannsynlighet: prognose.sannsynlighetInsolvens, type: "valgt" } as TiltakRad]
      : []),
    ...(pakke && pakke.tiltak.length > 1 && !mote
      ? [{ navn: "Anbefalt pakke", margin: pakke.prognose.margin, sannsynlighet: pakke.prognose.sannsynlighetInsolvens, type: "pakke" } as TiltakRad]
      : []),
  ];

  const under = prognose.margin < 0;
  const gronn = useMemo(() => vurderGronn(kunde, strompris, scenario), [kunde, strompris, scenario]);

  return (
    <div className="space-y-6">
      <Kort
        overtittel="Saldo inkl. trekkramme"
        tittel="Likviditetsprognose neste 13 uker"
        hoyre={
          !mote && (
            <button onClick={() => setVisMetode((v) => !v)} className="text-sm font-semibold text-snb-rod hover:underline">
              {visMetode ? "Skjul metode" : "Slik er prognosen laget"}
            </button>
          )
        }
      >
        {visMetode && !mote && <Metodeboks kunde={kunde} prognose={prognose} />}

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tall
            tittel={mote ? "Kassekredittramme" : "Insolvensgrense"}
            verdi={mnok(mote ? prognose.ramme : -prognose.ramme)}
            under={valg.rammeokning ? `inkl. +${mnok(valg.rammeokning)} midlertidig ramme` : mote ? `saldoen kan ikke gå under ${mnok(-prognose.ramme)}` : "kassekreditten brukt opp"}
            farge="text-red-600"
          />
          <Tall
            tittel={mote ? "Rammen strekker ikke til" : "Grensen passeres"}
            verdi={prognose.tomKasseDato ? kortDato(prognose.tomKasseDato) : "Nei"}
            under={prognose.tomKasseDato ? `${omUker(prognose.ukerTilTomKasse!)} · ${prognose.dagerUnderGrensen} dager under` : "ikke i forventet forløp"}
            farge={prognose.tomKasseDato ? "text-red-600" : "text-emerald-700"}
            sammenlign={sammenlign ? `${sammenlignNavn}: ${sammenlign.tomKasseDato ? kortDato(sammenlign.tomKasseDato) : "nei"}` : undefined}
          />
          <Tall
            tittel={mote ? "Sannsynlighet" : "Sannsynlighet for insolvens"}
            verdi={prosent(prognose.sannsynlighetInsolvens)}
            under={mote ? "for at rammen ikke strekker til i perioden" : "for å havne under grensen i perioden"}
            farge={prognose.sannsynlighetInsolvens >= 0.5 ? "text-red-600" : prognose.sannsynlighetInsolvens >= 0.2 ? "text-amber-600" : "text-emerald-700"}
            sammenlign={sammenlign ? `${sammenlignNavn}: ${prosent(sammenlign.sannsynlighetInsolvens)}` : undefined}
          />
          <Tall
            tittel={under ? "Mangler på det verste" : "Margin på det laveste"}
            verdi={kr(Math.abs(prognose.margin))}
            under={`${kortDato(prognose.lavesteDato)} · saldo ${mnok(prognose.lavesteSaldo)}`}
            farge={under ? "text-red-600" : "text-emerald-700"}
            sammenlign={
              sammenlign ? `${prognose.margin - sammenlign.margin >= 0 ? "+" : "−"}${kr(Math.abs(prognose.margin - sammenlign.margin))} mot ${sammenlignNavn.toLowerCase()}` : undefined
            }
          />
        </div>

        <PrognoseGraf historikk={kunde.dagligSaldo} prognose={prognose} sammenlign={sammenlign} sammenlignNavn={sammenlignNavn} grenseNavn={mote ? "Kassekredittramme" : "Insolvensgrense"} />
        <div className="mt-2 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <Forklaring stil={{ background: "#475569" }} tekst="Faktisk saldo" />
          <Forklaring stil={{ background: "#0f766e" }} tekst={aktiveTiltak.length ? "Prognose med tiltak" : "Prognose"} />
          {sammenlign && <Forklaring stil={{ borderTop: "2px dashed #94a3b8", height: 0 }} tekst={sammenlignNavn} />}
          <Forklaring stil={{ background: "rgba(15,118,110,0.15)", height: 10 }} tekst="80 %-intervall" />
          <Forklaring stil={{ background: "rgba(217,119,6,0.18)", height: 10 }} tekst="Varselsone (over 90 % av rammen)" />
          <Forklaring stil={{ background: "rgba(220,38,38,0.15)", height: 10 }} tekst={mote ? "Under rammen: regninger kan ikke betales" : "Betalingsudyktig: kan ikke betale forfalte krav"} />
        </div>
        <Risikostripe prognose={prognose} grenseNavn={mote ? "kassekredittrammen" : "insolvensgrensen"} />
      </Kort>

      <div className="space-y-6">
        <Kort overtittel="Scenarioer" tittel="Hva om …?" hoyre={<span className="text-xs text-slate-500">Tiltakene vurderes alltid mot valgt scenario</span>}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {scenarioer.map((s) => (
              <Bryter
                key={s.id}
                tittel={s.tittel}
                beskrivelse={s.beskrivelse}
                pa={scenarioPa.includes(s.id)}
                onClick={() => veksleScenario(s.id)}
                parameter={s.parameter}
                onEndre={(v) => setScenarioVerdier((p) => ({ ...p, [s.id]: v }))}
              />
            ))}
          </div>
        </Kort>

        <Kort
          overtittel={`${alleTiltak.length} mulige tiltak · velg for å simulere`}
          tittel={mote ? "Mulige tiltak" : "Tiltak mot mislighold"}
          hoyre={
            valgte.length > 0 && (
              <button onClick={() => setValgte([])} className="text-sm font-semibold text-snb-rod hover:underline">
                Fjern alle tiltak
              </button>
            )
          }
        >
          {mote ? (
            <p className="text-sm text-slate-600">Slå på ett eller flere tiltak for å se hvordan de påvirker saldoen i grafen over.</p>
          ) : (
            <Anbefaling vurdering={vurdering} pakkeErValgt={pakkeErValgt} onBruk={() => setValgte(pakke ? pakke.tiltak.map((t) => t.id) : [])} />
          )}
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {alleTiltak.map((t) => (
              <TiltakKnapp
                key={t.id}
                tiltak={t}
                pa={valgte.includes(t.id)}
                mote={mote}
                forbedring={effektFor(t.id)?.forbedring}
                onClick={() => veksleTiltak(t.id)}
                onEndre={(v) => setParametre((p) => ({ ...p, [t.id]: v }))}
              />
            ))}
          </div>
        </Kort>
      </div>

      {gronn && (
        <GronnKort g={gronn} klimakrav={kunde.klimakrav} aktiv={valgte.includes("energitiltak")} onVis={() => veksleTiltak("energitiltak")} />
      )}

      <Kort
        overtittel={`Margin til ${mote ? "kassekredittrammen" : "insolvensgrensen"} på det laveste punktet`}
        tittel="Effekt av tiltak"
        hoyre={<span className="text-xs text-slate-500">Hvert tiltak alene{scenarioAktiv ? ", gitt valgt scenario" : ""}</span>}
      >
        <TiltakGraf rader={rader} grenseNavn={mote ? "Kassekredittramme" : "Insolvensgrense"} />
        <p className="mt-2 text-xs text-slate-500">
          {mote ? "Søyler til venstre for streken betyr at rammen fortsatt ikke strekker til." : "Søyler til venstre for streken betyr at kunden fortsatt blir betalingsudyktig."} Tiltak som bare flytter betalinger i tid (f.eks. innfordring) kan hjelpe
          tidlig i perioden uten å endre det laveste punktet.
        </p>
      </Kort>

      <Kort overtittel="Kontantstrøm" tittel="Uke for uke" hoyre={<span className="text-xs text-slate-500">Klikk en uke for å se postene</span>}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pl-5">Uke</th>
                <th className="text-right">Inn</th>
                <th className="text-right">Ut</th>
                <th className="text-right">Laveste saldo</th>
                <th className="text-right">Saldo ved ukeslutt</th>
                <th className="pr-5 text-right">Sannsynlighet</th>
              </tr>
            </thead>
            <tbody>
              {prognose.uker.map((u) => {
                const brudd = u.minSaldo < -prognose.ramme;
                return (
                  <FragmentRad key={u.nr}>
                    <tr
                      onClick={() => setApenUke(apenUke === u.nr ? null : u.nr)}
                      className={`tall cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${brudd ? "bg-red-50/70" : ""}`}
                    >
                      <td className="py-2 pl-5">
                        <span className="mr-2 text-slate-400">{apenUke === u.nr ? "▾" : "▸"}</span>
                        {kortDato(u.fra)}
                      </td>
                      <td className="text-right text-emerald-700">{kr(u.inn)}</td>
                      <td className="text-right text-slate-700">−{kr(u.ut)}</td>
                      <td className={`text-right ${brudd ? "font-semibold text-red-600" : ""}`}>{kr(u.minSaldo)}</td>
                      <td className="text-right font-medium">{kr(u.sluttSaldo)}</td>
                      <td className={`pr-5 text-right ${u.sannsynlighet >= 0.5 ? "font-semibold text-red-600" : "text-slate-600"}`}>{prosent(u.sannsynlighet)}</td>
                    </tr>
                    {apenUke === u.nr && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={6} className="px-5 py-2">
                          <ul className="grid grid-cols-1 gap-x-8 gap-y-1 text-xs md:grid-cols-2">
                            {oppsummerPoster(u.poster).map((p) => (
                              <li key={p.navn} className="flex justify-between gap-4">
                                <span className={p.kategori === "tiltak" || p.kategori === "factoring" ? "font-medium text-teal-800" : "text-slate-600"}>{p.navn}</span>
                                <span className={`tall ${p.belop >= 0 ? "text-emerald-700" : "text-slate-800"}`}>{kr(p.belop)}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </FragmentRad>
                );
              })}
            </tbody>
          </table>
        </div>
      </Kort>
    </div>
  );
}

function Anbefaling({ vurdering, pakkeErValgt, onBruk }: { vurdering: ReturnType<typeof vurderTiltak>; pakkeErValgt: boolean; onBruk: () => void }) {
  const { basis, pakke } = vurdering;
  if (!pakke) {
    return (
      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        Kunden holder seg over insolvensgrensen med god margin ({kr(basis.margin)}) og lav sannsynlighet ({prosent(basis.sannsynlighetInsolvens)}). Ingen tiltak er
        nødvendig nå, men følg med.
      </div>
    );
  }
  const nok = pakke.prognose.margin >= 0;
  return (
    <div className={`rounded-lg px-3 py-2.5 text-sm ${nok ? "bg-teal-50 text-teal-950" : "bg-red-50 text-red-950"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-wide uppercase opacity-70">Anbefalt tiltakspakke</div>
          <div className="font-medium">{pakke.tiltak.map((t) => t.navn).join(" + ")}</div>
          <div className="text-xs">
            {nok
              ? `Holder kunden ${kr(pakke.prognose.margin)} over insolvensgrensen på det laveste. Sannsynlighet ned fra ${prosent(basis.sannsynlighetInsolvens)} til ${prosent(pakke.prognose.sannsynlighetInsolvens)}.`
              : `Selv med disse tiltakene mangler ${kr(-pakke.prognose.margin)}. Vurder overføring til spesialenhet, rekonstruksjon eller en større refinansiering.`}
          </div>
        </div>
        <button
          onClick={onBruk}
          disabled={pakkeErValgt}
          className="shrink-0 rounded-md bg-snb-rod px-3 py-1.5 text-xs font-semibold text-white hover:bg-snb-rod-mork disabled:bg-slate-300 disabled:text-slate-600"
        >
          {pakkeErValgt ? "Vises i prognosen" : "Vis i prognosen"}
        </button>
      </div>
      <div className="mt-1 text-[11px] opacity-70">Valgt etter minst mulig inngripen først, deretter størst effekt. Rådgiveren vurderer og beslutter.</div>
    </div>
  );
}

const AKTOR_STIL: Record<string, string> = {
  Kunden: "bg-sky-50 text-sky-800 ring-sky-200",
  Banken: "bg-teal-50 text-teal-800 ring-teal-200",
  Skatteetaten: "bg-violet-50 text-violet-800 ring-violet-200",
  Eier: "bg-amber-50 text-amber-800 ring-amber-200",
};

function TiltakKnapp({
  tiltak,
  pa,
  mote,
  forbedring,
  onClick,
  onEndre,
}: {
  tiltak: Tiltak;
  pa: boolean;
  mote: boolean;
  forbedring?: number;
  onClick: () => void;
  onEndre: (verdi: number) => void;
}) {
  const av = Boolean(tiltak.utilgjengelig);
  return (
    <div
      role="button"
      tabIndex={av ? -1 : 0}
      aria-pressed={pa}
      aria-disabled={av}
      onClick={() => !av && onClick()}
      onKeyDown={(e) => !av && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), onClick())}
      title={mote ? undefined : tiltak.forbehold}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
        av ? "cursor-not-allowed border-slate-100 opacity-50" : pa ? "cursor-pointer border-teal-600 bg-teal-50" : "cursor-pointer border-slate-200 hover:border-slate-300"
      }`}
    >
      <Vippe pa={pa} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-slate-900">{tiltak.navn}</span>
          <span className={`rounded px-1.5 text-[10px] font-medium ring-1 ring-inset ${AKTOR_STIL[tiltak.aktor]}`}>{tiltak.aktor}</span>
          {tiltak.betalingslettelse && !mote && (
            <span className="rounded bg-orange-50 px-1.5 text-[10px] font-medium text-orange-800 ring-1 ring-orange-200 ring-inset">Betalingslettelse</span>
          )}
        </span>
        <span className="block text-xs text-slate-500">{tiltak.utilgjengelig ?? tiltak.beskrivelse}</span>
        {tiltak.parameter && !av && <ParamFelt parameter={tiltak.parameter} onEndre={onEndre} />}
      </span>
      {forbedring !== undefined && !av && (
        <span className={`tall shrink-0 text-xs font-semibold ${forbedring > 0 ? "text-teal-700" : "text-slate-400"}`}>{forbedring > 0 ? `+${tusen(forbedring)}` : "±0"}</span>
      )}
    </div>
  );
}

const ENHET: Record<Parameter["enhet"], string> = { "%": "%", kr: "kr", dager: "dager", mnd: "mnd", pp: "prosentpoeng" };

// Tallfelt som lar rådgiveren endre forutsetningen. Klikk i feltet vipper ikke tiltaket.
function ParamFelt({ parameter, onEndre }: { parameter: Parameter; onEndre: (verdi: number) => void }) {
  const [tekst, setTekst] = useState(String(parameter.verdi));
  useEffect(() => setTekst(String(parameter.verdi)), [parameter.verdi]);
  const endret = parameter.verdi !== parameter.standard;
  return (
    <span className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <span>{parameter.etikett}</span>
      <input
        type="number"
        inputMode="decimal"
        value={tekst}
        min={parameter.min}
        max={parameter.maks}
        step={parameter.steg}
        onChange={(e) => {
          setTekst(e.target.value);
          const tall = Number(e.target.value.replace(",", "."));
          if (e.target.value !== "" && Number.isFinite(tall)) onEndre(tall);
        }}
        onBlur={() => setTekst(String(parameter.verdi))}
        className={`tall rounded border bg-white px-1.5 py-0.5 text-right text-xs outline-none focus:border-teal-600 ${parameter.enhet === "kr" ? "w-28" : "w-16"} ${
          endret ? "border-teal-500" : "border-slate-300"
        }`}
        aria-label={`${parameter.etikett} (${ENHET[parameter.enhet]})`}
      />
      <span>{ENHET[parameter.enhet]}</span>
      {endret && (
        <button type="button" onClick={() => onEndre(parameter.standard)} className="text-teal-700 hover:underline" title={`Tilbake til standard (${parameter.standard})`}>
          standard
        </button>
      )}
    </span>
  );
}

function Metodeboks({ kunde, prognose }: { kunde: Kunde; prognose: ReturnType<typeof lagPrognose> }) {
  const m = prognose.metode;
  const pst = (x: number) => `${x >= 1 ? "+" : "−"}${Math.abs(Math.round((x - 1) * 100))} %`;
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <ol className="list-decimal space-y-1 pl-4">
        <li>
          <b>Datagrunnlag:</b> {kunde.historikk.length} uker med transaksjoner og {kunde.dagligSaldo.length} dager med saldo fra bankens egne systemer
          {kunde.samtykke >= 2 ? `, pluss reskontro fra ${kunde.regnskapssystem ?? "regnskapssystemet"} (samtykke)` : ""}.
        </li>
        <li>
          <b>Normal drift:</b>{" "}
          {m.sesongnaiv
            ? `innbetalinger og variable kostnader fra samme uker i fjor, justert for utviklingen siste 12 uker mot samme uker året før (innbetalinger ${pst(m.vekstInn)}, variable kostnader ${pst(m.vekstUt)}). Sesongen følger dermed med uten antakelser.`
            : `vektet snitt av siste 12 uker (inn ${kr(m.nivaInnPerUke)} og variable kostnader ${kr(m.nivaUtPerUke)} per uke), sesongjustert, med dempet trend.`}
        </li>
        <li>
          <b>Kjente forfall</b> på eksakt dato: lønn, forskuddstrekk og AGA og strøm med beløp fra samme måned i fjor (fanger opp feriepenger, halv skatt og
          sesongbemanning), MVA beregnet av faktisk omsetning i terminen, husleie, renter, avdrag og sluttbetalinger på lån.
        </li>
        <li>
          <b>Reskontro:</b>{" "}
          {prognose.brukerReskontro
            ? "utestående fakturaer erstatter historikken de første fire ukene, justert for hvor sent hver kunde betaler."
            : "ikke tilgjengelig (krever samtykke)."}
        </li>
        <li>
          <b>Usikkerhet:</b> kundens egen uke-til-uke-variasjon ({kr(m.sigmaPerUke)} per uke) gir 80 %-intervallet og sannsynligheten for å havne under
          insolvensgrensen.
        </li>
        <li>
          <b>Insolvensgrensen</b> er når kassekreditten er brukt opp. Da kan kunden ikke betale forpliktelser når de forfaller (illikviditet, jf. konkursloven § 61).
        </li>
      </ol>
    </div>
  );
}

function FragmentRad({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tall({ tittel, verdi, under, farge, sammenlign }: { tittel: string; verdi: string; under: string; farge: string; sammenlign?: string }) {
  // Fargeboks som i bankens mal: lys rød ved fare, lys grønn når det holder, ellers grå
  const boks = farge.includes("red")
    ? "border-red-200 bg-snb-rod-lys"
    : farge.includes("emerald") || farge.includes("teal")
      ? "border-teal-200 bg-snb-gronn-lys"
      : "border-slate-200 bg-snb-gra";
  return (
    <div className={`rounded-lg border px-4 py-3 ${boks}`}>
      <div className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">{tittel}</div>
      <div className={`tall mt-0.5 font-overskrift text-2xl font-bold ${farge}`}>{verdi}</div>
      <div className="text-xs text-slate-600">{under}</div>
      {sammenlign && <div className="mt-1 text-xs font-semibold text-snb-gronn">{sammenlign}</div>}
    </div>
  );
}

function Vippe({ pa }: { pa: boolean }) {
  return (
    <span className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${pa ? "bg-teal-600" : "bg-slate-200"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${pa ? "left-4.5" : "left-0.5"}`} />
    </span>
  );
}

function Bryter({
  tittel,
  beskrivelse,
  pa,
  onClick,
  parameter,
  onEndre,
}: {
  tittel: string;
  beskrivelse: string;
  pa: boolean;
  onClick: () => void;
  parameter: Parameter;
  onEndre: (verdi: number) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={pa}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), onClick())}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${pa ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-slate-300"}`}
    >
      <Vippe pa={pa} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{tittel}</span>
        <span className="block text-xs text-slate-500">{beskrivelse}</span>
        <ParamFelt parameter={parameter} onEndre={onEndre} />
      </span>
    </div>
  );
}

function Forklaring({ stil, tekst }: { stil: React.CSSProperties; tekst: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-4" style={stil} />
      {tekst}
    </span>
  );
}
