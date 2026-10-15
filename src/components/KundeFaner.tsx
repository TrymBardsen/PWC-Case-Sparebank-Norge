"use client";

import { createContext, useContext, useState } from "react";

// Faner under kunden: Oversikt · Utforsk tiltak · Forbered samtale · Oppfølging.
// En fane monteres første gang den åpnes og blir liggende (skjult) etterpå, så valgte
// tiltak og scenarioer beholdes når rådgiveren bytter fane. Valgt fane står i adressen
// (?fane=…), så lenker kan peke rett til en fane og siden husker den ved omlasting.

export interface Fane {
  id: string;
  navn: string;
  innhold: React.ReactNode;
}

const VelgFane = createContext<(id: string) => void>(() => {});

export function KundeFaner({ faner, start }: { faner: Fane[]; start: string }) {
  const forste = faner.some((f) => f.id === start) ? start : faner[0].id;
  const [aktiv, setAktiv] = useState(forste);
  const [apnet, setApnet] = useState<string[]>([forste]);

  function velg(id: string) {
    setAktiv(id);
    setApnet((a) => (a.includes(id) ? a : [...a, id]));
    const url = new URL(window.location.href);
    if (id === faner[0].id) url.searchParams.delete("fane");
    else url.searchParams.set("fane", id);
    window.history.replaceState(null, "", url);
  }

  return (
    <VelgFane.Provider value={velg}>
      <div role="tablist" aria-label="Kundefaner" className="inline-flex flex-wrap gap-1.5 rounded-xl bg-snb-rod-flate p-1.5 print:hidden">
        {faner.map((f) => (
          <button
            key={f.id}
            role="tab"
            id={`fane-${f.id}`}
            aria-selected={f.id === aktiv}
            aria-controls={`panel-${f.id}`}
            onClick={() => velg(f.id)}
            className={`rounded-lg px-4 py-2 text-[15px] font-semibold transition ${
              f.id === aktiv ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {f.navn}
          </button>
        ))}
      </div>
      {faner.map(
        (f) =>
          apnet.includes(f.id) && (
            <div key={f.id} role="tabpanel" id={`panel-${f.id}`} aria-labelledby={`fane-${f.id}`} hidden={f.id !== aktiv} className="mt-6">
              {f.innhold}
            </div>
          ),
      )}
    </VelgFane.Provider>
  );
}

// Knapp inne i en fane som bytter til en annen fane (f.eks. «Utforsk tiltak →» fra Oversikt)
export function TilFane({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const velg = useContext(VelgFane);
  return (
    <button
      type="button"
      onClick={() => {
        velg(id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className={className}
    >
      {children}
    </button>
  );
}
