// Neste beste handling: ett konkret forslag per kunde, med ansvarlig og frist,
// i stedet for en lang kjede av tiltak. Bygger på den anbefalte tiltakspakken.

import type { Kunde } from "./types.ts";
import type { Vurdering } from "./score.ts";
import type { Tiltak, Tiltaksvurdering } from "./tiltak.ts";
import { DAGENS_DATO, kortDato, leggTilDager } from "./dato.ts";
import { liten, prosent } from "./format.ts";

export interface NesteHandling {
  tittel: string;
  hvorfor: string;
  ansvarlig: string;
  frist: string;
  tiltak?: Tiltak; // tiltaket handlingen gjelder, hvis noen
  flere: Tiltak[]; // resten av pakken, i rekkefølge
  kreditt: boolean; // krever kredittvurdering i banken (betalingslettelse fra banken)
}

const ANSVARLIG: Record<Tiltak["aktor"], string> = {
  Kunden: "Kunden, med rådgiver",
  Banken: "Rådgiver og kreditt",
  Skatteetaten: "Kunden søker, rådgiver hjelper",
  Eier: "Eier, med rådgiver",
};

// Frist en uke før grensen passeres, men aldri før i dag
function fristFor(v: Vurdering): string {
  const tom = v.prognose.tomKasseDato;
  if (!tom) return "Innen 2 uker";
  const frist = leggTilDager(tom, -7);
  return frist <= DAGENS_DATO ? "I dag" : `Før ${kortDato(frist)}`;
}

export function nesteHandling(kunde: Kunde, v: Vurdering, tv: Tiltaksvurdering): NesteHandling {
  if (kunde.sensitiv) {
    return {
      tittel: "Bare praktisk kontakt, når det passer kunden",
      hvorfor: "Banken har lovet kunden ro. Tiltak og produkter tas ikke opp nå.",
      ansvarlig: "Rådgiver",
      frist: "Ingen frist",
      flere: [],
      kreditt: false,
    };
  }
  const pakke = tv.pakke;
  if (pakke && pakke.tiltak.length) {
    const [forste, ...flere] = pakke.tiltak;
    const kreditt = forste.aktor === "Banken" && forste.betalingslettelse;
    const effekt = tv.effekter.find((e) => e.tiltak.id === forste.id);
    return {
      tittel: kreditt ? `Drøft ${liten(forste.navn)} og send til kredittvurdering` : `Avklar ${liten(forste.navn)} med kunden`,
      hvorfor: effekt
        ? `Det minst inngripende tiltaket med størst effekt: sannsynligheten for å passere grensen går fra ${prosent(tv.basis.sannsynlighetInsolvens)} til ${prosent(effekt.prognose.sannsynlighetInsolvens)}.`
        : "Første tiltak i den anbefalte pakken.",
      ansvarlig: ANSVARLIG[forste.aktor],
      frist: fristFor(v),
      tiltak: forste,
      flere,
      kreditt,
    };
  }
  if (v.niva === "Kritisk" || v.niva === "Høy") {
    return {
      tittel: "Lag en plan sammen med kunden og vurder spesialenhet",
      hvorfor: "Ingen av tiltakene alene holder kunden over grensen.",
      ansvarlig: "Rådgiver",
      frist: fristFor(v),
      flere: [],
      kreditt: false,
    };
  }
  if (v.niva === "Følg med") {
    return { tittel: "Ta en prat om de neste månedene", hvorfor: "Signalene bør følges, men det haster ikke.", ansvarlig: "Rådgiver", frist: "Innen 2 uker", flere: [], kreditt: false };
  }
  return { tittel: "Ingen handling nå", hvorfor: "Ingen tegn til likviditetsskvis i datagrunnlaget.", ansvarlig: "–", frist: "–", flere: [], kreditt: false };
}

// Kort form til agendaen: «Avklar betalingsavtale for MVA med kunden (og 2 til)»
export function kortForslag(n: NesteHandling): string {
  return `${n.tittel}${n.flere.length ? ` (og ${n.flere.length} tiltak til)` : ""}`;
}
