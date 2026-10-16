"use client";

// Lagring i nettleseren for demofunksjoner som i produksjon hører hjemme i CRM og saksbehandling
// (oppfølging, kredittsaker, deling, utsatte varsler, lister). Alt er per nettleser, ikke delt.

import { useCallback, useEffect, useState } from "react";
import { DAGENS_DATO } from "./dato";

const HENDELSE = "lokal-endret";

export function lesLokal<T>(nokkel: string, standard: T): T {
  try {
    const raa = localStorage.getItem(nokkel);
    return raa === null ? standard : (JSON.parse(raa) as T);
  } catch {
    return standard;
  }
}

export function skrivLokal<T>(nokkel: string, verdi: T | null) {
  try {
    if (verdi === null) localStorage.removeItem(nokkel);
    else localStorage.setItem(nokkel, JSON.stringify(verdi));
  } catch {
    // Ikke kritisk i demoen (privat modus, full lagring)
  }
  window.dispatchEvent(new CustomEvent(HENDELSE, { detail: nokkel }));
}

// Alle nøkler med et prefiks, f.eks. «plan:»
export function lokaleNokler(prefiks: string): string[] {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(prefiks));
  } catch {
    return [];
  }
}

// Leser en verdi og følger med på endringer fra andre komponenter på siden
export function useLokal<T>(nokkel: string, standard: T): [T, (verdi: T | null) => void, boolean] {
  const [verdi, setVerdi] = useState<T>(standard);
  const [lastet, setLastet] = useState(false);
  const standardJson = JSON.stringify(standard);
  useEffect(() => {
    const les = () => setVerdi(lesLokal(nokkel, JSON.parse(standardJson) as T));
    les();
    setLastet(true);
    const lytt = (e: Event) => (e as CustomEvent<string>).detail === nokkel && les();
    window.addEventListener(HENDELSE, lytt);
    return () => window.removeEventListener(HENDELSE, lytt);
  }, [nokkel, standardJson]);
  const sett = useCallback((ny: T | null) => skrivLokal(nokkel, ny), [nokkel]);
  return [verdi, sett, lastet];
}

// Felles oppfølgingslogg per kunde (vises under «Samtale»)
export interface Loggpost {
  dato: string;
  forfatter: string;
  tekst: string;
  utfall: string;
}

export function loggOppfolging(kundeId: string, forfatter: string, tekst: string, utfall: string) {
  const nokkel = `oppfolging:${kundeId}`;
  skrivLokal(nokkel, [...lesLokal<Loggpost[]>(nokkel, []), { dato: DAGENS_DATO, forfatter, tekst, utfall }]);
}

// Oppfølgingsplan: når rådgiveren skal ta kontakt igjen, og hva som er lovet kunden
export interface Plan {
  nesteDato: string;
  lovet: string;
}

// Saker sendt til kredittvurdering (demo: ingen ekte saksflyt)
export interface Kreditsak {
  dato: string;
  tiltak: string[];
  begrunnelse: string;
  status: "Sendt";
}

// Kunder delt med en kollega eller spesialenhet
export interface Deling {
  kundeId: string;
  kundenavn: string;
  fra: string;
  til: string;
  melding: string;
  dato: string;
}

// Utsatt eller avvist varsel i agendaen
export interface Utsatt {
  til: string; // dato varselet vises igjen
  grunn: string;
}
