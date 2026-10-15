"use client";

import { useMemo, useState } from "react";
import type { Kunde } from "@/lib/types";
import { lagPrognose, oppsummerPoster, STANDARDVALG, type PrognoseValg } from "@/lib/prognose";
import { kortDato } from "@/lib/dato";
import { kr, mnok, omUker } from "@/lib/format";
import { PrognoseGraf } from "./PrognoseGraf";
import { Kort } from "./ui";

interface Bryter {
  id: keyof PrognoseValg;
  tittel: string;
  beskrivelse: string;
  verdi: number | boolean;
  deaktivert?: string;
}

export function KundePrognose({ kunde, strompris }: { kunde: Kunde; strompris: number }) {
  const [valg, setValg] = useState<PrognoseValg>(STANDARDVALG);
  const [apenUke, setApenUke] = useState<number | null>(null);

  const basis = useMemo(() => lagPrognose(kunde), [kunde]);
  const aktiv = JSON.stringify(valg) !== JSON.stringify(STANDARDVALG);
  const prognose = useMemo(() => (aktiv ? lagPrognose(kunde, valg) : basis), [kunde, valg, aktiv, basis]);

  const storste = basis.storsteDebitor;
  const scenarioer: Bryter[] = [
    { id: "storsteKundeForsinkelse", tittel: `${storste} betaler 30 dager senere`, beskrivelse: `Største kunde, ${Math.round(basis.storsteDebitorAndel * 100)} % av innbetalingene`, verdi: 30 },
    { id: "renteTillegg", tittel: "Renten øker 1 prosentpoeng", beskrivelse: "På lån og kassekreditt", verdi: 0.01 },
    { id: "omsetningsfall", tittel: "Omsetningen faller 20 %", beskrivelse: "Variable kostnader faller bare halvparten", verdi: 0.2 },
    {
      id: "stromFaktor",
      tittel: "Strømprisen øker 50 %",
      beskrivelse: `Fra ${strompris.toFixed(2).replace(".", ",")} kr/kWh i dag (NO5), ${Math.round(kunde.faste.stromKwhPerMnd / 1000)} MWh/mnd`,
      verdi: 1.5,
    },
  ];
  const fakturaSum = (kunde.fakturaer ?? []).reduce((s, f) => s + f.belop, 0);
  const tiltak: Bryter[] = [
    {
      id: "factoring",
      tittel: "Løpende factoring",
      beskrivelse: fakturaSum ? `80 % forskudd på utestående (${mnok(fakturaSum)}) og nye fakturaer, gebyr 1,5 %` : "",
      verdi: true,
      deaktivert: kunde.fakturaer === undefined ? "Krever samtykke til reskontro" : fakturaSum === 0 ? "Ingen utestående fakturaer" : undefined,
    },
    { id: "rammeokning", tittel: "Midlertidig økt ramme", beskrivelse: `+${mnok(Math.max(500_000, Math.round(kunde.kassekredittRamme * 0.4 / 100_000) * 100_000))} i 3 måneder`, verdi: Math.max(500_000, Math.round(kunde.kassekredittRamme * 0.4 / 100_000) * 100_000) },
    { id: "avdragsfrihet", tittel: "Avdragsfrihet", beskrivelse: kunde.lan.length ? "Kun renter på lånene i perioden" : "", verdi: true, deaktivert: kunde.lan.length ? undefined : "Kunden har ingen lån" },
  ];

  const veksle = (b: Bryter) => {
    setValg((v) => ({ ...v, [b.id]: v[b.id] === STANDARDVALG[b.id] ? b.verdi : STANDARDVALG[b.id] }));
  };

  const endring = prognose.lavesteSaldo - basis.lavesteSaldo;

  return (
    <div className="space-y-6">
      <Kort
        tittel="Likviditetsprognose, 13 uker"
        hoyre={
          <span className="text-xs text-slate-500">
            {prognose.brukerReskontro ? "Bygger på historikk, kjente forfall og reskontro" : "Bygger på historikk og kjente forfall (uten reskontro)"}
          </span>
        }
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tall
            tittel="Tom kasse"
            verdi={prognose.tomKasseDato ? kortDato(prognose.tomKasseDato) : "Holder"}
            under={prognose.tomKasseDato ? omUker(prognose.ukerTilTomKasse!) : "innenfor rammen i 13 uker"}
            farge={prognose.tomKasseDato ? "text-red-600" : "text-emerald-700"}
            sammenlign={aktiv ? (basis.tomKasseDato ? `Uten endringer: ${kortDato(basis.tomKasseDato)}` : "Uten endringer: holder") : undefined}
          />
          <Tall
            tittel="Laveste saldo"
            verdi={mnok(prognose.lavesteSaldo)}
            under={`${kortDato(prognose.lavesteDato)} · ramme ${mnok(-prognose.ramme)}`}
            farge={prognose.lavesteSaldo < -prognose.ramme ? "text-red-600" : "text-slate-900"}
            sammenlign={aktiv && Math.abs(endring) > 1000 ? `${endring > 0 ? "+" : "−"}${kr(Math.abs(endring))} mot uten endringer` : undefined}
          />
          <Tall
            tittel="Mangler på det verste"
            verdi={prognose.lavesteSaldo < -prognose.ramme ? kr(-prognose.ramme - prognose.lavesteSaldo) : "0 kr"}
            under="utover kassekredittrammen"
            farge={prognose.lavesteSaldo < -prognose.ramme ? "text-red-600" : "text-emerald-700"}
          />
        </div>
        <PrognoseGraf historikk={kunde.dagligSaldo} prognose={prognose} basis={aktiv ? basis : undefined} />
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
          <Forklaring farge="bg-slate-600" tekst="Faktisk saldo" />
          <Forklaring farge="bg-teal-700" tekst="Prognose" />
          {aktiv && <Forklaring farge="bg-slate-400" tekst="Uten endringer" stiplet />}
          <Forklaring farge="bg-teal-700/15" tekst={`Usikkerhet (±${Math.round(prognose.usikkerhet * 100)} % av innbetalingene)`} />
          <Forklaring farge="bg-red-600" tekst="Kassekredittramme" stiplet />
        </div>
      </Kort>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Kort tittel="Hva om …?">
          <div className="space-y-2">
            {scenarioer.map((b) => (
              <Valg key={b.id} bryter={b} pa={valg[b.id] !== STANDARDVALG[b.id]} onClick={() => veksle(b)} />
            ))}
          </div>
        </Kort>
        <Kort tittel="Mulige tiltak">
          <div className="space-y-2">
            {tiltak.map((b) => (
              <Valg key={b.id} bryter={b} pa={valg[b.id] !== STANDARDVALG[b.id]} onClick={() => veksle(b)} />
            ))}
          </div>
          {aktiv && (
            <button onClick={() => setValg(STANDARDVALG)} className="mt-3 text-xs text-teal-700 hover:underline">
              Nullstill alle
            </button>
          )}
        </Kort>
      </div>

      <Kort tittel="Uke for uke" hoyre={<span className="text-xs text-slate-500">Klikk en uke for å se postene</span>}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pl-5">Uke</th>
                <th className="text-right">Inn</th>
                <th className="text-right">Ut</th>
                <th className="text-right">Laveste saldo</th>
                <th className="pr-5 text-right">Saldo ved ukeslutt</th>
              </tr>
            </thead>
            <tbody>
              {prognose.uker.map((u) => {
                const brudd = u.minSaldo < -prognose.ramme;
                return (
                  <FragmentRad key={u.nr}>
                    <tr
                      onClick={() => setApenUke(apenUke === u.nr ? null : u.nr)}
                      className={`tall cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${brudd ? "bg-red-50/60" : ""}`}
                    >
                      <td className="py-2 pl-5">
                        <span className="mr-2 text-slate-400">{apenUke === u.nr ? "▾" : "▸"}</span>
                        {kortDato(u.fra)}
                      </td>
                      <td className="text-right text-emerald-700">{kr(u.inn)}</td>
                      <td className="text-right text-slate-700">−{kr(u.ut)}</td>
                      <td className={`text-right ${brudd ? "font-semibold text-red-600" : ""}`}>{kr(u.minSaldo)}</td>
                      <td className="pr-5 text-right font-medium">{kr(u.sluttSaldo)}</td>
                    </tr>
                    {apenUke === u.nr && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={5} className="px-5 py-2">
                          <ul className="grid grid-cols-1 gap-x-8 gap-y-1 text-xs md:grid-cols-2">
                            {oppsummerPoster(u.poster).map((p) => (
                              <li key={p.navn} className="flex justify-between gap-4">
                                <span className="text-slate-600">{p.navn}</span>
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

function Valg({ bryter, pa, onClick }: { bryter: Bryter; pa: boolean; onClick: () => void }) {
  const av = Boolean(bryter.deaktivert);
  return (
    <button
      onClick={onClick}
      disabled={av}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
        av ? "cursor-not-allowed border-slate-100 opacity-50" : pa ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${pa ? "bg-teal-600" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${pa ? "left-4.5" : "left-0.5"}`} />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-900">{bryter.tittel}</span>
        <span className="block text-xs text-slate-500">{bryter.deaktivert ?? bryter.beskrivelse}</span>
      </span>
    </button>
  );
}

function Forklaring({ farge, tekst, stiplet }: { farge: string; tekst: string; stiplet?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-0.5 w-4 ${stiplet ? "border-t-2 border-dashed border-current bg-transparent " + farge.replace("bg-", "text-") : farge} ${farge.includes("/15") ? "h-2.5" : ""}`} />
      {tekst}
    </span>
  );
}
