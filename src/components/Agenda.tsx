"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Oppgave, Oppgavetype } from "@/lib/agenda";
import { DAGENS_DATO, kortDato, leggTilDager, ukedag } from "@/lib/dato";
import { Kort } from "./ui";

const TYPE: Record<Oppgavetype, { tekst: string; stil: string }> = {
  ring: { tekst: "Ring", stil: "bg-red-50 text-red-800 ring-red-200" },
  folgopp: { tekst: "Følg opp", stil: "bg-orange-50 text-orange-800 ring-orange-200" },
  sjekkinn: { tekst: "Tekstsignal", stil: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200" },
  eksponering: { tekst: "Smitte", stil: "bg-amber-50 text-amber-800 ring-amber-200" },
  gronn: { tekst: "Grønn mulighet", stil: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  mote: { tekst: "Glemt kunde", stil: "bg-slate-100 text-slate-700 ring-slate-200" },
};

const NOKKEL = `agenda:${DAGENS_DATO}`;

// Tre neste ledige tider på hverdager
function ledigeTider(): string[] {
  const tider: string[] = [];
  let d = DAGENS_DATO;
  while (tider.length < 3) {
    d = leggTilDager(d, 1);
    if (ukedag(d) < 5) tider.push(`${kortDato(d)} kl. ${tider.length % 2 === 0 ? "10.00" : "13.30"}`);
  }
  return tider;
}

// Skriver til samme logg som «Notater og oppfølging» på kundesiden
function loggOppfolging(kundeId: string, radgiver: string, tekst: string, utfall: string) {
  try {
    const nokkel = `oppfolging:${kundeId}`;
    const logg = JSON.parse(localStorage.getItem(nokkel) ?? "[]");
    logg.push({ dato: DAGENS_DATO, forfatter: radgiver, tekst, utfall });
    localStorage.setItem(nokkel, JSON.stringify(logg));
  } catch {
    // Ikke kritisk i demoen
  }
}

export function Agenda({ oppgaver, radgiver }: { oppgaver: Oppgave[]; radgiver: string }) {
  const [ferdig, setFerdig] = useState<Record<string, string>>({});
  const [melding, setMelding] = useState<{ oppgave: Oppgave; tekst: string } | null>(null);
  const [booker, setBooker] = useState<string | null>(null);

  useEffect(() => {
    try {
      setFerdig(JSON.parse(localStorage.getItem(NOKKEL) ?? "{}"));
    } catch {
      setFerdig({});
    }
  }, []);

  function fullfor(o: Oppgave, beskrivelse: string, utfall: string, loggtekst: string) {
    const ny = { ...ferdig, [o.id]: beskrivelse };
    setFerdig(ny);
    loggOppfolging(o.kundeId, radgiver, loggtekst, utfall);
    try {
      localStorage.setItem(NOKKEL, JSON.stringify(ny));
    } catch {
      // Ikke kritisk i demoen
    }
  }

  function angre(id: string) {
    const ny = { ...ferdig };
    delete ny[id];
    setFerdig(ny);
    try {
      localStorage.setItem(NOKKEL, JSON.stringify(ny));
    } catch {
      // Ikke kritisk i demoen
    }
  }

  const uten = oppgaver.reduce((s, o) => s + o.minutterUten, 0);
  const med = oppgaver.reduce((s, o) => s + o.minutterMed, 0);
  const spart = oppgaver.filter((o) => ferdig[o.id]).reduce((s, o) => s + o.minutterUten - o.minutterMed, 0);
  const tid = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} t ${min % 60 ? `${min % 60} min` : ""}`.trim() : `${min} min`);

  return (
    <Kort
      overtittel={`${oppgaver.length} oppgaver i dag`}
      tittel="Dagens agenda"
      hoyre={
        <span className="text-right text-xs text-slate-500">
          Forberedelse ca. <b className="text-teal-700">{tid(med)}</b> i stedet for ca. {tid(uten)}
          {spart > 0 && <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 font-medium text-teal-800">Spart så langt: {tid(spart)}</span>}
        </span>
      }
    >
      <ol className="space-y-2">
        {oppgaver.map((o, i) => {
          const gjort = ferdig[o.id];
          return (
            <li key={o.id} className={`rounded-lg border px-4 py-3 ${gjort ? "border-slate-100 bg-slate-50" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className={`min-w-0 flex-1 ${gjort ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tall text-xs text-slate-400">{i + 1}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TYPE[o.type].stil}`}>{TYPE[o.type].tekst}</span>
                    <span className={`text-sm font-medium text-slate-900 ${gjort ? "line-through" : ""}`}>{o.tittel}</span>
                    <span className={`text-[11px] ${o.frist === "I dag" ? "font-medium text-red-600" : "text-slate-500"}`}>{o.frist}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{o.grunn}</p>
                  {o.forslag && <p className="mt-0.5 text-xs font-medium text-teal-800">→ {o.forslag}</p>}
                </div>
                {gjort ? (
                  <span className="flex items-center gap-2 text-xs text-emerald-700">
                    ✓ {gjort}
                    <button onClick={() => angre(o.id)} className="text-slate-400 hover:underline">
                      angre
                    </button>
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-1.5 text-xs">
                    {(o.type === "ring" || o.type === "folgopp") && (
                      <Knapp primar onClick={() => fullfor(o, "Samtale logget", "Ringt kunden", `Ringte ${o.kontakt}. ${o.forslag ?? ""}`.trim())}>
                        Logg samtale
                      </Knapp>
                    )}
                    <Knapp primar={o.type !== "ring" && o.type !== "folgopp"} onClick={() => setMelding({ oppgave: o, tekst: o.melding })}>
                      Send melding
                    </Knapp>
                    <Knapp onClick={() => setBooker(booker === o.id ? null : o.id)}>Book møte</Knapp>
                    <Link href={`/kunde/${o.kundeId}`} className="rounded-md px-2 py-1 font-semibold whitespace-nowrap text-snb-rod hover:underline">
                      Åpne →
                    </Link>
                  </span>
                )}
              </div>
              {booker === o.id && !gjort && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Ledige tider:</span>
                  {ledigeTider().map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        fullfor(o, `Møte ${t}`, "Møte avtalt", `Møte med ${o.kontakt} booket ${t}.`);
                        setBooker(null);
                      }}
                      className="rounded-full border border-teal-600 px-2.5 py-0.5 text-teal-800 hover:bg-teal-50"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {melding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setMelding(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-sm font-semibold">Melding til {melding.oppgave.kontakt}</div>
            <div className="mb-3 text-xs text-slate-500">{melding.oppgave.kundenavn} · forhåndsutfylt, rediger fritt</div>
            <textarea
              value={melding.tekst}
              onChange={(e) => setMelding({ ...melding, tekst: e.target.value })}
              rows={9}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">Demo: meldingen sendes ikke, men logges på kunden.</span>
              <span className="flex gap-2">
                <Knapp onClick={() => setMelding(null)}>Avbryt</Knapp>
                <Knapp
                  primar
                  onClick={() => {
                    fullfor(melding.oppgave, "Melding sendt", "Melding sendt", `Sjekk-inn-melding sendt: «${melding.tekst.split("\n").filter(Boolean)[1] ?? melding.tekst}»`);
                    setMelding(null);
                  }}
                >
                  Send
                </Knapp>
              </span>
            </div>
          </div>
        </div>
      )}
    </Kort>
  );
}

function Knapp({ children, onClick, primar }: { children: React.ReactNode; onClick: () => void; primar?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-semibold ${primar ? "bg-snb-rod text-white hover:bg-snb-rod-mork" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
    >
      {children}
    </button>
  );
}
