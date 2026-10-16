"use client";

import { useState } from "react";
import type { Notat } from "@/lib/types";
import { DAGENS_DATO, langDato, leggTilDager } from "@/lib/dato";
import { loggOppfolging, useLokal, type Loggpost, type Plan } from "@/lib/lokal";
import { Kort } from "./ui";

const UTFALL = ["Ringt kunden", "Møte avtalt", "Tiltak foreslått", "Kunden har kontroll", "Falsk alarm"] as const;

// Oppfølging lagres i nettleseren i demoen. I produksjon skrives den til CRM,
// og utfallet brukes til å kalibrere varslene (hvilke tiltak som faktisk hjalp).
export function Oppfolging({ kundeId, notater, radgiver }: { kundeId: string; notater: Notat[]; radgiver: string }) {
  const [logg] = useLokal<Loggpost[]>(`oppfolging:${kundeId}`, []);
  const [plan, setPlan] = useLokal<Plan | null>(`plan:${kundeId}`, null);
  const [tekst, setTekst] = useState("");
  const [utfall, setUtfall] = useState<string>(UTFALL[0]);
  const [nesteDato, setNesteDato] = useState(leggTilDager(DAGENS_DATO, 14));
  const [lovet, setLovet] = useState("");

  const alle = [...notater.map((n) => ({ ...n, utfall: "" })), ...logg].sort((a, b) => b.dato.localeCompare(a.dato));

  return (
    <Kort tittel="Notater og oppfølging">
      <div className="mb-5 rounded-lg border border-slate-200 p-3">
        <div className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Neste oppfølging</div>
        {plan ? (
          <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
            <span>
              <b>{langDato(plan.nesteDato)}</b>
              {plan.lovet && <span className="block text-slate-700">Du lovet: {plan.lovet}</span>}
              <span className="block text-xs text-slate-500">Kommer opp i agendaen på datoen.</span>
            </span>
            <button onClick={() => setPlan(null)} className="text-xs font-semibold text-snb-rod hover:underline">
              Fjern
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label className="text-xs text-slate-600">
              Dato
              <input type="date" value={nesteDato} min={DAGENS_DATO} onChange={(e) => setNesteDato(e.target.value)} className="mt-0.5 block rounded-md border border-slate-300 px-2 py-1 text-sm" />
            </label>
            <label className="min-w-48 flex-1 text-xs text-slate-600">
              Hva har du lovet kunden?
              <input
                value={lovet}
                onChange={(e) => setLovet(e.target.value)}
                placeholder="F.eks. svar på søknad om avdragsfrihet"
                className="mt-0.5 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <button
              disabled={!nesteDato}
              onClick={() => {
                setPlan({ nesteDato, lovet: lovet.trim() });
                loggOppfolging(kundeId, radgiver, `Ny oppfølging satt til ${langDato(nesteDato)}${lovet.trim() ? `: ${lovet.trim()}` : "."}`, "Oppfølging planlagt");
                setLovet("");
              }}
              className="rounded-md bg-snb-gronn px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
            >
              Sett påminnelse
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {UTFALL.map((u) => (
            <button
              key={u}
              onClick={() => setUtfall(u)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${utfall === u ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-600"}`}
            >
              {u}
            </button>
          ))}
        </div>
        <textarea
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          rows={2}
          placeholder="Hva ble avtalt?"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
        <button
          onClick={() => {
            loggOppfolging(kundeId, radgiver, tekst.trim(), utfall);
            setTekst("");
          }}
          disabled={!tekst.trim()}
          className="rounded-md bg-snb-gronn px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
        >
          Logg oppfølging
        </button>
      </div>
      <ul className="space-y-3">
        {alle.map((n, i) => (
          <li key={i} className="border-l-2 border-slate-200 pl-3 text-sm">
            <div className="text-xs text-slate-500">
              {langDato(n.dato)} · {n.forfatter}
              {n.utfall && <span className="ml-2 rounded bg-teal-50 px-1.5 text-teal-800">{n.utfall}</span>}
            </div>
            <div className="text-slate-800">{n.tekst}</div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-500">Demo: logg og påminnelser lagres bare i denne nettleseren. I drift hører de hjemme i CRM.</p>
    </Kort>
  );
}
