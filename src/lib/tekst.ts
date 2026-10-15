// Signaler fra ustrukturert tekst: rådgivernotater, e-post fra kunden, nyheter og
// kunngjøringer. Hvert signal har et ordrett sitat som må finnes i kilden. Sitater
// som ikke kan verifiseres, forkastes, så et signal aldri bygger på noe som ikke står der.

import type { Kunde, Tekstkilde } from "./types.ts";
import { DAGENS_DATO, dagerMellom } from "./dato.ts";

export const KATEGORIER = ["kundetap", "betalingsproblemer", "etterspørsel", "nedbemanning", "klimakrav", "grønn interesse", "positiv"] as const;
export type Kategori = (typeof KATEGORIER)[number];

export const KATEGORI_TEKST: Record<Kategori, string> = {
  kundetap: "Risiko for kundetap",
  betalingsproblemer: "Betalingsproblemer",
  etterspørsel: "Svakere etterspørsel",
  nedbemanning: "Nedbemanning",
  klimakrav: "Klimakrav (overgangsrisiko)",
  "grønn interesse": "Grønn mulighet",
  positiv: "Positivt signal",
};

// Poeng i prioriteringsscoren per kategori (negative signaler)
export const KATEGORI_POENG: Record<Kategori, number> = {
  kundetap: 6,
  betalingsproblemer: 4,
  etterspørsel: 3,
  nedbemanning: 3,
  klimakrav: 1,
  "grønn interesse": 0,
  positiv: 0,
};

export interface Tekstsignal {
  kildeId: string;
  kategori: Kategori;
  alvor: 1 | 2 | 3;
  oppsummering: string;
  sitat: string; // ordrett fra kilden
  gjelderDebitor: string | null; // navnet på en av kundens kunder, hvis signalet gjelder den
}

export interface Tekstanalyse {
  metode: "claude" | "regelbasert";
  modell?: string;
  tidspunkt: string;
  signaler: Tekstsignal[];
  forkastet: number; // sitater som ikke fantes i kilden
}

export function alleTekster(kunde: Kunde): Tekstkilde[] {
  return [
    ...kunde.notater.map((n, i) => ({ id: `${kunde.id}-n${i + 1}`, type: "notat" as const, dato: n.dato, avsender: `Rådgivernotat, ${n.forfatter}`, tekst: n.tekst })),
    ...kunde.tekster,
  ].sort((a, b) => b.dato.localeCompare(a.dato));
}

const normaliser = (s: string) => s.replace(/[«»"“”]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// Sitatet må stå ordrett i kilden (ignorerer anførselstegn og mellomrom)
export function verifiserSitat(signal: Pick<Tekstsignal, "kildeId" | "sitat">, kilder: Tekstkilde[]): boolean {
  const kilde = kilder.find((k) => k.id === signal.kildeId);
  if (!kilde || signal.sitat.trim().length < 8) return false;
  return normaliser(kilde.tekst).includes(normaliser(signal.sitat));
}

// Finn hvilken av kundens kunder en tekst handler om (enkelt navnetreff)
export function finnDebitor(kunde: Kunde, tekst: string): string | null {
  const t = tekst.toLowerCase();
  for (const d of kunde.debitorer) {
    const stamme = d.navn.replace(/\(.*\)/, "").replace(/\b(AS|ASA)\b/g, "").trim().toLowerCase();
    const forsteOrd = stamme.split(" ")[0];
    if (stamme.length >= 5 && (t.includes(stamme) || (forsteOrd.length >= 8 && t.includes(forsteOrd)))) return d.navn;
  }
  return null;
}

// Regelbasert reserve: ordliste per kategori, setning for setning
const ORDLISTE: { kategori: Kategori; alvor: 1 | 2 | 3; monster: RegExp }[] = [
  { kategori: "kundetap", alvor: 3, monster: /ikke forlenges|ikke fornyes|anbudskonkurranse|lyser ut|bytte leverandør|tapt kontrakt|sier opp avtalen/i },
  { kategori: "betalingsproblemer", alvor: 3, monster: /inkasso|ubetalt|etter med betaling|ligger .* etter|stoppet videre arbeid/i },
  { kategori: "betalingsproblemer", alvor: 2, monster: /utsatt avdrag|utsette|betalingsfrist|drar ut|forskuttere|før lønn/i },
  { kategori: "nedbemanning", alvor: 2, monster: /permitter|nedbemann|sagt opp|si opp|stoppet nyansettelser/i },
  { kategori: "etterspørsel", alvor: 2, monster: /på vent|avventer|svakt .*salg|færre|nedgang|lavpris|importkontroll|ventetid/i },
  { kategori: "klimakrav", alvor: 1, monster: /klimaregnskap|csrd|nullutslipp|utslippskutt|miljøkrav/i },
  { kategori: "grønn interesse", alvor: 1, monster: /varmepumpe|solceller|grønne? lån|enova|varmegjenvinning|elbil/i },
  { kategori: "positiv", alvor: 1, monster: /vinner|fornyet|ny rammeavtale|rekord|økt omsetning/i },
];

const OPPSUMMERING: Record<Kategori, string> = {
  kundetap: "Kunden kan miste en viktig avtale eller kunde.",
  betalingsproblemer: "Tegn på at betalingene strammer seg til.",
  etterspørsel: "Etterspørselen eller markedet svekkes.",
  nedbemanning: "Bemanningen reduseres, hos kunden eller en viktig motpart.",
  klimakrav: "Kunder eller regelverk stiller nye klimakrav.",
  "grønn interesse": "Kunden er interessert i energi- eller klimatiltak.",
  positiv: "Positiv utvikling.",
};

export function delISetninger(tekst: string): string[] {
  // Del bare der et ord slutter med punktum og neste setning starter med stor bokstav (ikke «1. desember»)
  return tekst.split(/(?<=[\wæøåÆØÅ)»][.!?])\s+(?=[A-ZÆØÅ«–])/).map((s) => s.trim()).filter(Boolean);
}

export function regelbasertAnalyse(kunde: Kunde): Tekstanalyse {
  const signaler: Tekstsignal[] = [];
  for (const kilde of alleTekster(kunde)) {
    // Sterkeste treff per kategori i hver kilde; ved lik styrke foretrekkes treff som nevner en av kundens kunder
    const beste = new Map<Kategori, Tekstsignal>();
    for (const setning of delISetninger(kilde.tekst)) {
      for (const o of ORDLISTE) {
        if (!o.monster.test(setning)) continue;
        const kandidat: Tekstsignal = {
          kildeId: kilde.id,
          kategori: o.kategori,
          alvor: o.alvor,
          oppsummering: OPPSUMMERING[o.kategori],
          sitat: setning,
          gjelderDebitor: finnDebitor(kunde, setning),
        };
        const naa = beste.get(o.kategori);
        if (!naa || kandidat.alvor > naa.alvor || (kandidat.alvor === naa.alvor && !naa.gjelderDebitor && kandidat.gjelderDebitor)) beste.set(o.kategori, kandidat);
        break;
      }
    }
    signaler.push(...beste.values());
  }
  return { metode: "regelbasert", tidspunkt: new Date().toISOString(), signaler, forkastet: 0 };
}

// Poeng i scoren: sterkeste signal per kategori siste 120 dager,
// forsterket når signalet gjelder en kunde som står for mye av innbetalingene.
export function tekstpoeng(kunde: Kunde, analyse: Tekstanalyse): { poeng: number; viktigste: Tekstsignal | null } {
  const kilder = alleTekster(kunde);
  const ferske = analyse.signaler.filter((s) => {
    const k = kilder.find((x) => x.id === s.kildeId);
    return k && dagerMellom(k.dato, DAGENS_DATO) <= 120 && KATEGORI_POENG[s.kategori] > 0;
  });
  const vekt = (s: Tekstsignal) => {
    const debitor = kunde.debitorer.find((d) => d.navn === s.gjelderDebitor);
    return KATEGORI_POENG[s.kategori] * (s.alvor === 3 ? 1 : s.alvor === 2 ? 0.8 : 0.6) * (debitor && debitor.andelAvInnbetalinger >= 0.3 ? 1.5 : 1);
  };
  const perKategori = new Map<Kategori, Tekstsignal>();
  for (const s of ferske) {
    const naa = perKategori.get(s.kategori);
    if (!naa || vekt(s) > vekt(naa)) perKategori.set(s.kategori, s);
  }
  const valgte = [...perKategori.values()].sort((a, b) => vekt(b) - vekt(a));
  return { poeng: Math.min(15, Math.round(valgte.reduce((sum, s) => sum + vekt(s), 0))), viktigste: valgte[0] ?? null };
}
