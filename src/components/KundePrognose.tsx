"use client";

import { useMemo, useState } from "react";
import type { Kunde } from "@/lib/types";
import { lagPrognose, oppsummerPoster, STANDARDVALG, type PrognoseValg } from "@/lib/prognose";
import { tiltakFor, vurderTiltak, type Tiltak } from "@/lib/tiltak";
import { kortDato } from "@/lib/dato";
import { kr, mnok, omUker, prosent, tusen } from "@/lib/format";
import { PrognoseGraf, Risikostripe } from "./PrognoseGraf";
import { TiltakGraf, type TiltakRad } from "./TiltakGraf";
import { Kort } from "./ui";

interface Scenario {
  id: keyof PrognoseValg;
  tittel: string;
  beskrivelse: string;
  verdi: number;
}

export function KundePrognose({ kunde, strompris }: { kunde: Kunde; strompris: number }) {
  const [scenario, setScenario] = useState<PrognoseValg>(STANDARDVALG);
  const [valgte, setValgte] = useState<string[]>([]);
  const [apenUke, setApenUke] = useState<number | null>(null);
  const [visMetode, setVisMetode] = useState(false);

  const alleTiltak = useMemo(() => tiltakFor(kunde), [kunde]);
  const standard = useMemo(() => lagPrognose(kunde), [kunde]);
  const vurdering = useMemo(() => vurderTiltak(kunde, scenario), [kunde, scenario]);
  const aktiveTiltak = alleTiltak.filter((t) => valgte.includes(t.id));
  const valg = aktiveTiltak.reduce<PrognoseValg>((v, t) => ({ ...v, ...t.valg }), scenario);
  const valgNokkel = JSON.stringify(valg);
  const prognose = useMemo(
    () => (aktiveTiltak.length ? lagPrognose(kunde, JSON.parse(valgNokkel) as PrognoseValg) : vurdering.basis),
    [kunde, valgNokkel, aktiveTiltak.length, vurdering.basis],
  );

  const scenarioAktiv = JSON.stringify(scenario) !== JSON.stringify(STANDARDVALG);
  const sammenlign = aktiveTiltak.length ? vurdering.basis : scenarioAktiv ? standard : undefined;
  const sammenlignNavn = aktiveTiltak.length ? (scenarioAktiv ? "Scenario uten tiltak" : "Uten tiltak") : "Uten scenario";

  // Kort- og kontantsalg kan ikke «betale senere», så scenarioet gir bare mening for fakturakunder
  const storsteErFakturakunde = !kunde.debitorer.some((d) => d.navn === standard.storsteDebitor && d.snittDagerForsinkelse <= 2 && d.andelAvInnbetalinger >= 0.6);
  const alleScenarioer: Scenario[] = [
    { id: "storsteKundeForsinkelse", tittel: `${standard.storsteDebitor} betaler 30 dager senere`, beskrivelse: `Største kunde, ${prosent(standard.storsteDebitorAndel)} av innbetalingene`, verdi: 30 },
    { id: "renteTillegg", tittel: "Renten øker 1 prosentpoeng", beskrivelse: "På lån og kassekreditt", verdi: 0.01 },
    { id: "omsetningsfall", tittel: "Omsetningen faller 20 %", beskrivelse: "Variable kostnader faller bare halvparten", verdi: 0.2 },
    {
      id: "stromFaktor",
      tittel: "Strømprisen øker 50 %",
      beskrivelse: `Fra ${strompris.toFixed(2).replace(".", ",")} kr/kWh i dag (NO5), ${Math.round(kunde.faste.stromKwhPerMnd / 1000)} MWh/mnd`,
      verdi: 1.5,
    },
  ];
  const scenarioer = alleScenarioer.filter((s) => s.id !== "storsteKundeForsinkelse" || storsteErFakturakunde);

  const veksleScenario = (s: Scenario) => setScenario((v) => ({ ...v, [s.id]: v[s.id] === STANDARDVALG[s.id] ? s.verdi : STANDARDVALG[s.id] }));
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
    ...(pakke && pakke.tiltak.length > 1
      ? [{ navn: "Anbefalt pakke", margin: pakke.prognose.margin, sannsynlighet: pakke.prognose.sannsynlighetInsolvens, type: "pakke" } as TiltakRad]
      : []),
  ];

  const under = prognose.margin < 0;

  return (
    <div className="space-y-6">
      <Kort
        tittel="Likviditetsprognose og insolvensgrense, 13 uker"
        hoyre={
          <button onClick={() => setVisMetode((v) => !v)} className="text-xs text-teal-700 hover:underline">
            {visMetode ? "Skjul metode" : "Slik er prognosen laget"}
          </button>
        }
      >
        {visMetode && <Metodeboks kunde={kunde} prognose={prognose} />}

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tall
            tittel="Insolvensgrense"
            verdi={mnok(-prognose.ramme)}
            under={valg.rammeokning ? `inkl. +${mnok(valg.rammeokning)} midlertidig ramme` : "kassekreditten brukt opp"}
            farge="text-red-600"
          />
          <Tall
            tittel="Grensen passeres"
            verdi={prognose.tomKasseDato ? kortDato(prognose.tomKasseDato) : "Nei"}
            under={prognose.tomKasseDato ? `${omUker(prognose.ukerTilTomKasse!)} · ${prognose.dagerUnderGrensen} dager under` : "ikke i forventet forløp"}
            farge={prognose.tomKasseDato ? "text-red-600" : "text-emerald-700"}
            sammenlign={sammenlign ? `${sammenlignNavn}: ${sammenlign.tomKasseDato ? kortDato(sammenlign.tomKasseDato) : "nei"}` : undefined}
          />
          <Tall
            tittel="Sannsynlighet for insolvens"
            verdi={prosent(prognose.sannsynlighetInsolvens)}
            under="for å havne under grensen i perioden"
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

        <PrognoseGraf historikk={kunde.dagligSaldo} prognose={prognose} sammenlign={sammenlign} sammenlignNavn={sammenlignNavn} />
        <div className="mt-2 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <Forklaring stil={{ background: "#475569" }} tekst="Faktisk saldo" />
          <Forklaring stil={{ background: "#0f766e" }} tekst={aktiveTiltak.length ? "Prognose med tiltak" : "Prognose"} />
          {sammenlign && <Forklaring stil={{ borderTop: "2px dashed #94a3b8", height: 0 }} tekst={sammenlignNavn} />}
          <Forklaring stil={{ background: "rgba(15,118,110,0.15)", height: 10 }} tekst="80 %-intervall" />
          <Forklaring stil={{ background: "rgba(217,119,6,0.18)", height: 10 }} tekst="Varselsone (over 90 % av rammen)" />
          <Forklaring stil={{ background: "rgba(220,38,38,0.15)", height: 10 }} tekst="Betalingsudyktig: kan ikke betale forfalte krav" />
        </div>
        <Risikostripe prognose={prognose} />
      </Kort>

      <div className="space-y-6">
        <Kort tittel="Hva om …?" hoyre={<span className="text-xs text-slate-500">Tiltakene vurderes alltid mot valgt scenario</span>}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {scenarioer.map((s) => (
              <Bryter key={s.id} tittel={s.tittel} beskrivelse={s.beskrivelse} pa={scenario[s.id] !== STANDARDVALG[s.id]} onClick={() => veksleScenario(s)} />
            ))}
          </div>
        </Kort>

        <Kort
          tittel="Tiltak mot mislighold"
          hoyre={
            valgte.length > 0 && (
              <button onClick={() => setValgte([])} className="text-xs text-teal-700 hover:underline">
                Fjern alle tiltak
              </button>
            )
          }
        >
          <Anbefaling vurdering={vurdering} pakkeErValgt={pakkeErValgt} onBruk={() => setValgte(pakke ? pakke.tiltak.map((t) => t.id) : [])} />
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {alleTiltak.map((t) => (
              <TiltakKnapp key={t.id} tiltak={t} pa={valgte.includes(t.id)} forbedring={effektFor(t.id)?.forbedring} onClick={() => veksleTiltak(t.id)} />
            ))}
          </div>
        </Kort>
      </div>

      <Kort
        tittel="Effekt av tiltak: margin til insolvensgrensen på det laveste punktet"
        hoyre={<span className="text-xs text-slate-500">Hvert tiltak alene{scenarioAktiv ? ", gitt valgt scenario" : ""}</span>}
      >
        <TiltakGraf rader={rader} />
        <p className="mt-2 text-xs text-slate-500">
          Søyler til venstre for streken betyr at kunden fortsatt blir betalingsudyktig. Tiltak som bare flytter betalinger i tid (f.eks. innfordring) kan hjelpe
          tidlig i perioden uten å endre det laveste punktet.
        </p>
      </Kort>

      <Kort tittel="Uke for uke" hoyre={<span className="text-xs text-slate-500">Klikk en uke for å se postene</span>}>
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
          className="shrink-0 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:bg-slate-300 disabled:text-slate-600"
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

function TiltakKnapp({ tiltak, pa, forbedring, onClick }: { tiltak: Tiltak; pa: boolean; forbedring?: number; onClick: () => void }) {
  const av = Boolean(tiltak.utilgjengelig);
  return (
    <button
      onClick={onClick}
      disabled={av}
      title={tiltak.forbehold}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
        av ? "cursor-not-allowed border-slate-100 opacity-50" : pa ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <Vippe pa={pa} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-slate-900">{tiltak.navn}</span>
          <span className={`rounded px-1.5 text-[10px] font-medium ring-1 ring-inset ${AKTOR_STIL[tiltak.aktor]}`}>{tiltak.aktor}</span>
          {tiltak.betalingslettelse && (
            <span className="rounded bg-orange-50 px-1.5 text-[10px] font-medium text-orange-800 ring-1 ring-orange-200 ring-inset">Betalingslettelse</span>
          )}
        </span>
        <span className="block text-xs text-slate-500">{tiltak.utilgjengelig ?? tiltak.beskrivelse}</span>
      </span>
      {forbedring !== undefined && !av && (
        <span className={`tall shrink-0 text-xs font-semibold ${forbedring > 0 ? "text-teal-700" : "text-slate-400"}`}>{forbedring > 0 ? `+${tusen(forbedring)}` : "±0"}</span>
      )}
    </button>
  );
}

function Metodeboks({ kunde, prognose }: { kunde: Kunde; prognose: ReturnType<typeof lagPrognose> }) {
  const m = prognose.metode;
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <ol className="list-decimal space-y-1 pl-4">
        <li>
          <b>Sesong:</b>{" "}
          {m.sesong === "egen og bransje" ? `kundens egen profil fra i fjor, blandet 50/50 med bransjeprofilen for ${kunde.bransje.toLowerCase()}` : "bransjeprofil"}.
        </li>
        <li>
          <b>Nivå:</b> vektet snitt av siste 12 uker (halveringstid 3 uker): inn {kr(m.nivaInnPerUke)} og variable kostnader {kr(m.nivaUtPerUke)} per uke,
          sesongjustert.
        </li>
        <li>
          <b>Trend:</b> innbetalingene endrer seg {(m.trendPerUke * 100).toFixed(1).replace(".", ",")} % per uke. Trenden videreføres, men dempes med 20 % per uke.
        </li>
        <li>
          <b>Kjente forfall</b> på eksakt dato: lønn, forskuddstrekk og AGA, MVA (beregnet av faktisk omsetning i terminen), husleie, strøm, renter og avdrag.
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
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{tittel}</div>
      <div className={`tall text-xl font-semibold ${farge}`}>{verdi}</div>
      <div className="text-xs text-slate-500">{under}</div>
      {sammenlign && <div className="mt-1 text-xs font-medium text-teal-700">{sammenlign}</div>}
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

function Bryter({ tittel, beskrivelse, pa, onClick }: { tittel: string; beskrivelse: string; pa: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${pa ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-slate-300"}`}
    >
      <Vippe pa={pa} />
      <span>
        <span className="block text-sm font-medium text-slate-900">{tittel}</span>
        <span className="block text-xs text-slate-500">{beskrivelse}</span>
      </span>
    </button>
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
