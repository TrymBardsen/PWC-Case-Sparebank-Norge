"use client";

import Link from "next/link";
import { useState } from "react";
import type { Niva } from "@/lib/score";
import type { Samtykkeniva } from "@/lib/types";
import { useLokal } from "@/lib/lokal";
import { Kort, NivaPille, SamtykkeMerke, Utnyttelse } from "./ui";

export interface Rad {
  id: string;
  navn: string;
  undertekst: string;
  sensitiv?: string;
  score: number;
  niva: Niva;
  bransje: string;
  tid: { tekst: string; under?: string; stil: string };
  signal?: string;
  ogsa?: string;
  kk: number;
  dagerSiden: number | null;
  samtykke: Samtykkeniva;
  graf: React.ReactNode; // minigraf tegnet på serveren
}

interface Filter {
  niva: "risiko" | "hoy" | "alle";
  bransje: string;
  ikkeKontaktet: boolean;
  sok: string;
}

const STANDARD: Filter = { niva: "risiko", bransje: "", ikkeKontaktet: false, sok: "" };
const NIVA_TEKST: Record<Filter["niva"], string> = { hoy: "Kritisk og høy", risiko: "Følg med og over", alle: "Alle" };

function passer(r: Rad, f: Filter): boolean {
  if (f.niva === "hoy" && r.niva !== "Kritisk" && r.niva !== "Høy") return false;
  if (f.niva === "risiko" && r.niva === "Lav") return false;
  if (f.bransje && r.bransje !== f.bransje) return false;
  if (f.ikkeKontaktet && r.dagerSiden !== null && r.dagerSiden <= 365) return false;
  if (f.sok && !r.navn.toLowerCase().includes(f.sok.toLowerCase())) return false;
  return true;
}

// Porteføljen med filter og egne lister (lagres i nettleseren i demoen)
export function Portefoljetabell({ rader }: { rader: Rad[] }) {
  const [filter, setFilter] = useState<Filter>(STANDARD);
  const [lister, setLister] = useLokal<{ navn: string; filter: Filter }[]>("lister", []);
  const [nyListe, setNyListe] = useState("");
  const bransjer = [...new Set(rader.map((r) => r.bransje))].sort((a, b) => a.localeCompare(b, "nb"));
  const synlige = rader.filter((r) => passer(r, filter));
  const endre = (del: Partial<Filter>) => setFilter((f) => ({ ...f, ...del }));

  return (
    <Kort overtittel={`Sortert etter risikoscore · ${synlige.length} av ${rader.length} kunder`} tittel="Varsler i porteføljen">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
          {(Object.keys(NIVA_TEKST) as Filter["niva"][]).map((n) => (
            <button
              key={n}
              onClick={() => endre({ niva: n })}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${filter.niva === n ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
            >
              {NIVA_TEKST[n]}
            </button>
          ))}
        </div>
        <select value={filter.bransje} onChange={(e) => endre({ bransje: e.target.value })} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs" aria-label="Bransje">
          <option value="">Alle bransjer</option>
          {bransjer.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-700">
          <input type="checkbox" checked={filter.ikkeKontaktet} onChange={(e) => endre({ ikkeKontaktet: e.target.checked })} />
          Ikke kontaktet siste år
        </label>
        <input
          value={filter.sok}
          onChange={(e) => endre({ sok: e.target.value })}
          placeholder="Søk på navn"
          className="w-36 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          aria-label="Søk på kundenavn"
        />
        <span className="ml-auto flex items-center gap-1.5 text-xs">
          <input
            value={nyListe}
            onChange={(e) => setNyListe(e.target.value)}
            placeholder="Navn på liste"
            className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1"
            aria-label="Navn på ny liste"
          />
          <button
            disabled={!nyListe.trim()}
            onClick={() => {
              setLister([...lister.filter((l) => l.navn !== nyListe.trim()), { navn: nyListe.trim(), filter }]);
              setNyListe("");
            }}
            className="rounded-md border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-40"
          >
            Lagre som liste
          </button>
        </span>
      </div>
      {lister.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500">Mine lister:</span>
          {lister.map((l) => (
            <span key={l.navn} className="inline-flex items-center rounded-full border border-teal-600 bg-teal-50 text-teal-800">
              <button onClick={() => setFilter(l.filter)} className="px-2.5 py-0.5 font-medium">
                {l.navn}
              </button>
              <button onClick={() => setLister(lister.filter((x) => x.navn !== l.navn))} className="pr-2 text-teal-600 hover:text-teal-900" aria-label={`Slett listen ${l.navn}`}>
                ×
              </button>
            </span>
          ))}
          {JSON.stringify(filter) !== JSON.stringify(STANDARD) && (
            <button onClick={() => setFilter(STANDARD)} className="font-semibold text-snb-rod hover:underline">
              Nullstill filter
            </button>
          )}
        </div>
      )}

      <div className="-mx-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-snb-gronn text-left text-[13px] font-semibold text-white">
              <th className="py-3 pr-3 pl-6">Kunde</th>
              <th className="px-3 py-3">Risikoscore</th>
              <th className="px-3 py-3">
                Saldo
                <span className="block text-[11px] font-normal opacity-80">90 dager + prognose</span>
              </th>
              <th className="px-3 py-3">Tid til skvis</th>
              <th className="px-3 py-3">Viktigste signal</th>
              <th className="px-3 py-3">Kassekreditt</th>
              <th className="px-3 py-3">Siste kontakt</th>
              <th className="py-3 pr-6 pl-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {synlige.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-6 text-center text-sm text-slate-500">
                  Ingen kunder passer filteret.
                </td>
              </tr>
            )}
            {synlige.map((r) => (
              <tr key={r.id} className="group border-b border-slate-200 align-top last:border-0 even:bg-snb-gra/60 hover:bg-snb-gra">
                <td className="min-w-56 py-4 pr-3 pl-6">
                  <Link href={`/kunde/${r.id}`} className="font-overskrift text-[15px] font-bold text-slate-900 group-hover:text-snb-rod">
                    {r.navn}
                  </Link>
                  <div className="text-xs text-slate-500">{r.undertekst}</div>
                  {r.sensitiv && (
                    <div className="mt-1 inline-block rounded-full bg-snb-gronn-lys px-2 py-0.5 text-[10px] font-semibold text-snb-gronn" title={r.sensitiv}>
                      Sensitiv situasjon – kun praktisk kontakt
                    </div>
                  )}
                </td>
                <td className="px-3 py-4">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="tall w-6 text-right font-overskrift text-base font-bold text-slate-900">{r.score}</span>
                    <NivaPille niva={r.niva} />
                  </span>
                </td>
                <td className="px-3 py-3">{r.graf}</td>
                <td className="tall px-3 py-4 whitespace-nowrap">
                  <span className={r.tid.stil}>
                    {r.tid.tekst}
                    {r.tid.under && <span className="block text-xs font-normal text-slate-500">{r.tid.under}</span>}
                  </span>
                </td>
                <td className="px-3 py-4 text-[13px] text-slate-700">
                  {r.signal ? (
                    <>
                      <span className="line-clamp-2" title={r.signal}>
                        {r.signal}
                      </span>
                      {r.ogsa && <span className="mt-0.5 block text-xs text-slate-500">Også: {r.ogsa}</span>}
                    </>
                  ) : (
                    <span className="text-slate-400">Ingen signaler</span>
                  )}
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <Utnyttelse andel={r.kk} />
                </td>
                <td className={`tall px-3 py-4 text-xs whitespace-nowrap ${r.dagerSiden === null || r.dagerSiden > 365 ? "font-semibold text-red-700" : "text-slate-600"}`}>
                  {r.dagerSiden === null ? "Ingen registrert" : `${r.dagerSiden} dager siden`}
                </td>
                <td className="py-4 pr-6 pl-3 whitespace-nowrap">
                  <SamtykkeMerke niva={r.samtykke} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Sannsynligheten er et modellanslag fra prognosen, ikke en kalibrert sannsynlighet. «Dager under» viser hvor lenge saldoen er under grensen i forventet
        forløp, og skiller kunder som alle har høy sannsynlighet. Lister og filtre lagres bare i denne nettleseren.
      </p>
    </Kort>
  );
}
