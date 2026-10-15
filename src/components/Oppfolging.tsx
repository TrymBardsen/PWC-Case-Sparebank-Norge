"use client";

import { useEffect, useState } from "react";
import type { Notat } from "@/lib/types";
import { DAGENS_DATO, langDato } from "@/lib/dato";
import { Kort } from "./ui";

const UTFALL = ["Ringt kunden", "Møte avtalt", "Tiltak foreslått", "Kunden har kontroll", "Falsk alarm"] as const;

interface Logg extends Notat {
  utfall: string;
}

// Oppfølging lagres i nettleseren i demoen. I produksjon skrives den til CRM,
// og utfallet brukes til å kalibrere varslene (hvilke tiltak som faktisk hjalp).
export function Oppfolging({ kundeId, notater, radgiver }: { kundeId: string; notater: Notat[]; radgiver: string }) {
  const nokkel = `oppfolging:${kundeId}`;
  const [logg, setLogg] = useState<Logg[]>([]);
  const [tekst, setTekst] = useState("");
  const [utfall, setUtfall] = useState<string>(UTFALL[0]);

  useEffect(() => {
    try {
      setLogg(JSON.parse(localStorage.getItem(nokkel) ?? "[]"));
    } catch {
      setLogg([]);
    }
  }, [nokkel]);

  function lagre() {
    const ny = [...logg, { dato: DAGENS_DATO, forfatter: radgiver, tekst: tekst.trim(), utfall }];
    setLogg(ny);
    setTekst("");
    try {
      localStorage.setItem(nokkel, JSON.stringify(ny));
    } catch {
      // Ikke kritisk i demoen
    }
  }

  const alle = [...notater.map((n) => ({ ...n, utfall: "" })), ...logg].reverse();

  return (
    <Kort tittel="Notater og oppfølging">
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
        <button onClick={lagre} disabled={!tekst.trim()} className="rounded-md bg-snb-gronn px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40">
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
    </Kort>
  );
}
