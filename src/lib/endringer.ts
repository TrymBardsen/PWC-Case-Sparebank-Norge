// «Hva er nytt siden sist»: endringer i porteføljen de siste 14 dagene.
// Bare det som faktisk kan observeres i dataene med dato (saldo, trekk på kassekreditten,
// avviste betalinger og registerhendelser). Scoren beregnes ikke bakover i tid, fordi
// flere av signalene (forfalte terminer, restanser, reskontro) bare finnes som øyeblikksbilde.

import type { Kunde } from "./types.ts";
import { DAGENS_DATO, dagerMellom, kortDato, leggTilDager } from "./dato.ts";
import { kr } from "./format.ts";

export const VINDU_DAGER = 14;
export const VINDU_FRA = leggTilDager(DAGENS_DATO, -VINDU_DAGER);

export type Retning = "verre" | "bedre" | "nytt";

export interface Endring {
  type: "kassekreditt" | "overtrekk" | "saldo" | "avvist" | "hendelse";
  retning: Retning;
  tekst: string;
  vekt: number; // for sortering: hvor mye endringen betyr
}

const iVinduet = (dato: string) => dagerMellom(dato, DAGENS_DATO) >= 0 && dagerMellom(dato, DAGENS_DATO) < VINDU_DAGER;
const snitt = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);

export function endringerFor(kunde: Kunde): Endring[] {
  const e: Endring[] = [];
  const ramme = kunde.kassekredittRamme;
  const trekk = kunde.kassekredittTrekk;

  // Kassekreditt: snittutnyttelse siste 7 dager mot de 7 dagene for to uker siden.
  // Trekket svinger med lønn og forfall i måneden, så bare terskler (80 % og 100 %) meldes.
  if (ramme > 0 && trekk.length >= 21) {
    const fra = Math.round((snitt(trekk.slice(-21, -14)) / ramme) * 100);
    const til = Math.round((snitt(trekk.slice(-7)) / ramme) * 100);
    const endring = `snitt ${fra} % → ${til} %`;
    if (til >= 100 && fra < 100) e.push({ type: "kassekreditt", retning: "verre", tekst: `Kassekreditten er brukt opp (${endring})`, vekt: 4 });
    else if (til >= 80 && fra < 80) e.push({ type: "kassekreditt", retning: "verre", tekst: `Kassekreditten over 80 % utnyttet (${endring})`, vekt: 2 });
    else if (fra >= 80 && til < 80) e.push({ type: "kassekreditt", retning: "bedre", tekst: `Kassekreditten under 80 % igjen (${endring})`, vekt: 1 });

    const dagerOver = trekk.slice(-VINDU_DAGER).filter((x) => x > ramme).length;
    if (dagerOver > 0) e.push({ type: "overtrekk", retning: "verre", tekst: `Overtrukket ${dagerOver} dag${dagerOver > 1 ? "er" : ""}`, vekt: 3 });
  }

  // Saldo: snitt siste uke mot uken før, målt mot rammen
  {
    const saldo = kunde.dagligSaldo.map((d) => d.saldo);
    const diff = snitt(saldo.slice(-7)) - snitt(saldo.slice(-14, -7));
    const relativ = diff / Math.max(ramme, 100_000);
    if (relativ <= -0.25) e.push({ type: "saldo", retning: "verre", tekst: `Snittsaldo ned ${kr(-diff)} fra uken før`, vekt: 2 });
    else if (relativ >= 0.25) e.push({ type: "saldo", retning: "bedre", tekst: `Snittsaldo opp ${kr(diff)} fra uken før`, vekt: 1 });
  }

  // Avviste betalinger med dato i vinduet
  {
    const nye = kunde.avvisteBetalinger.filter((a) => iVinduet(a.dato));
    if (nye.length)
      e.push({
        type: "avvist",
        retning: "verre",
        tekst: `${nye.length} betaling${nye.length > 1 ? "er" : ""} avvist (${kr(nye.reduce((s, a) => s + a.belop, 0))})`,
        vekt: 3,
      });
  }

  // Nye hendelser og notater
  for (const t of kunde.tekster.filter((x) => iVinduet(x.dato)))
    e.push({ type: "hendelse", retning: "nytt", tekst: `${kortDato(t.dato)} ${t.avsender}${t.tittel ? ` (${t.tittel.toLowerCase()})` : ""}: ${forkort(t.tekst)}`, vekt: 1 });
  for (const n of kunde.notater.filter((x) => iVinduet(x.dato)))
    e.push({ type: "hendelse", retning: "nytt", tekst: `${kortDato(n.dato)} Notat: ${forkort(n.tekst)}`, vekt: 0.5 });

  return e.sort((a, b) => b.vekt - a.vekt);
}

function forkort(tekst: string, maks = 110): string {
  return tekst.length <= maks ? tekst : `${tekst.slice(0, maks).replace(/\s+\S*$/, "")} …`;
}
