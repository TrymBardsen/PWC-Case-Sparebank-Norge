// Det vi ikke vet, og antakelsene prognosen hviler på. Vises for rådgiveren på kundesiden
// og sendes med i samtaleunderlaget, så utkastet ikke framstår sikrere enn datagrunnlaget.

import type { Kunde } from "./types.ts";
import type { Prognose } from "./prognose.ts";
import type { Tekstanalyse } from "./tekst.ts";
import { DAGENS_DATO, dagerMellom, kortDato, langDato } from "./dato.ts";
import { kr } from "./format.ts";

export interface Usikkerhet {
  tema: string;
  tekst: string;
  sporsmal?: string; // det rådgiveren kan spørre kunden om
}

export function usikkerheterFor(kunde: Kunde, prognose: Prognose, tekstanalyse?: Tekstanalyse): Usikkerhet[] {
  const liste: Usikkerhet[] = [];
  const forste = prognose.dager[0]?.dato ?? DAGENS_DATO;
  const siste = prognose.dager.at(-1)?.dato ?? DAGENS_DATO;

  if (kunde.samtykke < 2) {
    liste.push({
      tema: "Reskontro",
      tekst: "Uten tilgang til regnskapssystemet vet vi ikke hvem som skylder kunden penger, når fakturaene forfaller, eller om det finnes MVA- eller forskuddstrekkrestanser. Innbetalingene anslås fra historikken.",
      sporsmal: "Hvem skylder dere penger nå, og når regner dere med å få betalt? Vil dere gi oss tilgang til regnskapssystemet?",
    });
  }

  for (const lan of kunde.lan) {
    if (!lan.sluttdato || lan.saldo <= 0) continue;
    if (lan.sluttdato < forste) {
      liste.push({
        tema: "Lån",
        tekst: `${lan.navn} hadde sluttdato ${langDato(lan.sluttdato)}, men står med saldo ${kr(lan.saldo)}. Prognosen antar at terminene fortsetter som før. Avklar om lånet er forlenget eller skal refinansieres.`,
        sporsmal: `Hva er planen for ${lan.navn.toLowerCase()}, som har passert sluttdatoen?`,
      });
    } else if ((lan.sluttbetaling ?? 0) > 0 && lan.sluttdato <= siste) {
      liste.push({
        tema: "Lån",
        tekst: `Prognosen regner med at ${lan.navn.toLowerCase()} gjøres opp med ${kr(lan.sluttbetaling!)} ${kortDato(lan.sluttdato)}. Blir lånet refinansiert eller forlenget, faller posten bort.`,
        sporsmal: `Hvordan har dere tenkt å håndtere sluttbetalingen på ${kr(lan.sluttbetaling!)} ${kortDato(lan.sluttdato)}?`,
      });
    } else if ((lan.sluttbetaling ?? 0) > 0 && dagerMellom(siste, lan.sluttdato) <= 90) {
      liste.push({
        tema: "Lån",
        tekst: `Sluttbetaling på ${kr(lan.sluttbetaling!)} for ${lan.navn.toLowerCase()} forfaller ${langDato(lan.sluttdato)}, rett etter prognoseperioden.`,
      });
    }
  }

  if ((kunde.restanser?.skatt ?? 0) > 0) {
    liste.push({
      tema: "Restskatt",
      tekst: `Prognosen antar at restskatten på ${kr(kunde.restanser!.skatt)} betales om ti dager. Om det finnes en betalingsavtale, vet vi ikke.`,
      sporsmal: "Har dere en avtale med Skatteetaten om restskatten?",
    });
  }
  if ((kunde.forfaltLeverandorgjeld ?? 0) > 0) {
    liste.push({
      tema: "Leverandørgjeld",
      tekst: `Forfalt leverandørgjeld (${kr(kunde.forfaltLeverandorgjeld!)}) antas nedbetalt i tre like deler de neste tre ukene.`,
      sporsmal: "Hvordan har dere tenkt å betale ned den forfalte leverandørgjelden, og har leverandørene sagt noe?",
    });
  }
  if (kunde.debitorer.length === 0) {
    liste.push({ tema: "Betalere", tekst: "Ingen registrerte betalere. Avhengighet av enkeltkunder kan ikke vurderes.", sporsmal: "Hvem er de viktigste kundene deres?" });
  }
  if (tekstanalyse?.metode === "regelbasert") {
    liste.push({ tema: "Tekstsignaler", tekst: "Signalene i notater og hendelser er funnet med en fast ordliste og kan overse viktige forhold. Les kildene selv." });
  }
  if (kunde.samtykke < 3) {
    liste.push({
      tema: "Eier",
      tekst: "Eierens mulighet til å skyte inn kapital eller stille kausjon er ukjent (finnes ikke i datagrunnlaget).",
      sporsmal: "Kan eier bidra med kapital eller sikkerhet hvis det blir nødvendig?",
    });
  }
  liste.push({
    tema: "Metode",
    tekst: "Prognosen og scoren er regelbaserte og ikke testet mot faktiske utfall. Usikkerhetsbåndet bygger bare på kundens egen uke-til-uke-variasjon.",
  });
  return liste;
}

// Største kjente utbetalinger fremover (lønn, skatt, MVA, lån, restanser), til kundevisningen.
// Kunden kjenner igjen postene, i motsetning til en uketabell med saldo og sannsynlighet.
export function storsteUtbetalinger(prognose: Prognose, antall = 5): { dato: string; navn: string; belop: number }[] {
  const kjente = new Set(["lonn", "skatt", "mva", "lan", "restanse", "husleie", "feriepenger"]);
  return prognose.uker
    .flatMap((u) => u.poster)
    .filter((p) => p.belop < 0 && kjente.has(p.kategori) && p.dato)
    .map((p) => ({ dato: p.dato!, navn: p.navn, belop: -p.belop }))
    .sort((a, b) => b.belop - a.belop)
    .slice(0, antall)
    .sort((a, b) => a.dato.localeCompare(b.dato));
}
