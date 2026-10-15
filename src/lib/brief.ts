// Samtaleunderlag for rådgiveren. Claude får kun fakta vi selv har beregnet,
// og må knytte hvert punkt til en kilde. Uten API-nøkkel brukes en regelbasert mal.

import { z } from "zod";
import type { Kunde } from "./types";
import type { Smitte, Vurdering } from "./score";
import { DAGENS_DATO, dagerMellom, kortDato, langDato } from "./dato";
import { oppsummerPoster } from "./prognose";
import { tiltakFor, vurderTiltak } from "./tiltak";
import { kr, mnok, omUker, prosent } from "./format";

export const BriefSchema = z.object({
  oppsummering: z.string().describe("2–3 setninger om situasjonen, skrevet til rådgiveren"),
  hvaHarSkjedd: z
    .array(z.object({ punkt: z.string(), kilde: z.string().describe("Hvilket signal eller hvilken datakilde punktet bygger på") }))
    .describe("3–5 konkrete observasjoner med tall"),
  sporsmal: z.array(z.string()).describe("4–6 åpne spørsmål rådgiveren bør stille kunden"),
  tiltak: z
    .array(
      z.object({
        navn: z.string(),
        begrunnelse: z.string(),
        effekt: z.string().describe("Forventet effekt på likviditeten, med tall fra fakta der mulig"),
        forbehold: z.string(),
      }),
    )
    .describe("2–4 tiltak rangert etter egnethet, mest egnet først"),
  apning: z.string().describe("Forslag til hvordan rådgiveren kan åpne samtalen, i én eller to setninger, varm og ikke-alarmerende"),
  ikkeVurdert: z.array(z.string()).describe("Hva vi ikke vet pga. manglende data eller samtykke"),
});

export type Brief = z.infer<typeof BriefSchema> & { kilde: "claude" | "mal"; modell?: string };

export function lagFakta(kunde: Kunde, vurdering: Vurdering, smitte: Smitte[], alleKunder: Kunde[]) {
  const p = vurdering.prognose;
  const navn = (id: string) => alleKunder.find((k) => k.id === id)?.navn ?? id;
  const tv = vurderTiltak(kunde);
  const effekt = (pr: typeof p) => ({
    grensenPasseres: pr.tomKasseDato ? kortDato(pr.tomKasseDato) : "nei",
    marginPaLaveste: kr(pr.margin),
    sannsynlighetInsolvens: prosent(pr.sannsynlighetInsolvens),
  });
  const tomUke = p.tomKasseDato ? p.uker.find((u) => u.poster.some((x) => x.dato === p.tomKasseDato)) : undefined;

  return {
    dagensDato: langDato(DAGENS_DATO),
    kunde: {
      navn: kunde.navn,
      bransje: kunde.bransje,
      ansatte: kunde.ansatte,
      dagligLeder: kunde.dagligLeder,
      etablert: kunde.etablert,
      risikoklasse: kunde.risikoklasse,
      sesongbedrift: kunde.sesongbedrift,
      samtykkeniva: kunde.samtykke,
      regnskapIFjor: { omsetning: mnok(kunde.regnskapIFjor.driftsinntekter), resultat: kr(kunde.regnskapIFjor.aarsresultat), egenkapital: kr(kunde.regnskapIFjor.egenkapital) },
    },
    engasjement: {
      kassekredittRamme: kr(kunde.kassekredittRamme),
      saldoNa: kr(p.startSaldo),
      lan: kunde.lan.map((l) => ({ navn: l.navn, saldo: kr(l.saldo), forfalteTerminer: l.forfalteTerminer })),
      sikkerheter: kr(kunde.sikkerheter),
    },
    score: { verdi: vurdering.score, niva: vurdering.niva },
    signaler: vurdering.faktorer.filter((f) => f.poeng > 0 || f.ukjent).map((f) => ({ signal: f.navn, poeng: f.poeng, forklaring: f.forklaring, kilde: f.kilde })),
    prognose: {
      tomKasse: p.tomKasseDato ? `${kortDato(p.tomKasseDato)} (${omUker(p.ukerTilTomKasse!)})` : "nei, holder i 13 uker",
      utlosendePosterDenUken: tomUke ? oppsummerPoster(tomUke.poster).filter((x) => x.belop < 0).slice(0, 3).map((x) => `${x.navn}: ${kr(-x.belop)}`) : [],
      lavesteSaldo: `${kr(p.lavesteSaldo)} den ${kortDato(p.lavesteDato)}`,
      innbetalingerEndring: prosent(p.innEndring),
      brukerReskontro: p.brukerReskontro,
    },
    debitorer: kunde.debitorer.map((d) => ({ navn: d.navn, andel: prosent(d.andelAvInnbetalinger), snittDagerForsinkelse: d.snittDagerForsinkelse })),
    utestaendeFakturaer: kunde.fakturaer?.map((f) => ({ debitor: f.debitor, belop: kr(f.belop), forfall: kortDato(f.forfall), dagerOverForfall: Math.max(0, dagerMellom(f.forfall, DAGENS_DATO)) })),
    insolvens: {
      grense: `${kr(-p.ramme)} (kassekreditten brukt opp; kunden kan ikke betale forfalte krav)`,
      ...effekt(p),
      dagerUnderGrensen: p.dagerUnderGrensen,
    },
    tiltak: tv.effekter.map((e) => ({
      navn: e.tiltak.navn,
      beskrivelse: e.tiltak.beskrivelse,
      aktor: e.tiltak.aktor,
      betalingslettelse: e.tiltak.betalingslettelse,
      forbehold: e.tiltak.forbehold,
      forbedringAvMargin: kr(e.forbedring),
      ...effekt(e.prognose),
    })),
    ikkeMuligeTiltak: tiltakFor(kunde).filter((t) => t.utilgjengelig).map((t) => `${t.navn}: ${t.utilgjengelig}`),
    anbefaltPakke: tv.pakke ? { tiltak: tv.pakke.tiltak.map((t) => t.navn), ...effekt(tv.pakke.prognose) } : "ingen tiltak nødvendig",
    tekstsignaler: vurdering.tekstanalyse.signaler.map((t) => ({ kategori: t.kategori, sitat: t.sitat, gjelderKunde: t.gjelderDebitor, kilde: kunde.tekster.find((x) => x.id === t.kildeId)?.avsender ?? "Rådgivernotat" })),
    nettverk: smitte
      .filter((s) => s.fra === kunde.id || s.til === kunde.id)
      .map((s) => (s.fra === kunde.id ? `${navn(s.til)} får ${prosent(s.andel)} av innbetalingene sine fra denne kunden` : `Får ${prosent(s.andel)} av innbetalingene fra ${navn(s.fra)}`)),
    rådgivernotater: kunde.notater,
    dagerSidenSisteKontakt: dagerMellom(kunde.sisteKontakt, DAGENS_DATO),
  };
}

export const SYSTEM = `Du er en erfaren kredittrådgiver i en norsk bank som forbereder en kollega i bedriftsmarkedet til en samtale med en bedriftskunde om likviditet.

Du får et JSON-objekt med fakta som banken allerede har beregnet. Regler:
- Bruk bare tall og fakta som står i JSON-en. Ikke finn på tall, navn eller hendelser.
- Hvert punkt under hvaHarSkjedd skal ha en kilde som peker på et signal, prognosen, reskontro eller et rådgivernotat.
- Les rådgivernotatene nøye; de inneholder ofte det viktigste tidlige signalet.
- Målet er å hjelpe kunden gjennom en vanskelig periode, ikke å redusere bankens risiko for enhver pris. Unngå tiltak som kan utløse krisen (f.eks. å kutte rammen nå).
- Insolvensgrensen er når kassekreditten er brukt opp. Forklar hvor nær kunden er grensen, når den passeres og hvor sannsynlig det er.
- Tiltak skal velges fra listen tiltak, bruke effekttallene derfra og helst bygge på anbefaltPakke. Merk tiltak som er betalingslettelser: de må vurderes, merkes og dokumenteres etter bankens retningslinjer.
- Taushetsplikt: nettverk og debitorer som også er kunder i banken er intern informasjon. Nevn dem aldri ved navn i apning eller sporsmal, som sies til kunden.
- Bruk tekstsignalene (ordrette sitater fra e-post, nyheter og notater) når de forklarer situasjonen, og oppgi kilden.
- Du er beslutningsstøtte. Rådgiveren tar beslutningen.
- Skriv på norsk bokmål, kort og presist, uten markdown.`;

// Regelbasert reserve, brukes når API-nøkkel mangler eller kallet feiler
export function lagMalBrief(fakta: ReturnType<typeof lagFakta>, kunde: Kunde): Brief {
  const p = fakta.prognose;
  const signaler = [...fakta.signaler].filter((s) => s.poeng > 0).sort((a, b) => b.poeng - a.poeng);
  const storste = kunde.debitorer[0];
  const sisteNotat = kunde.notater[kunde.notater.length - 1];

  const tv = vurderTiltak(kunde);
  const pakkeIder = tv.pakke?.tiltak.map((t) => t.id) ?? [];
  const tiltak: Brief["tiltak"] = [...tv.effekter]
    .filter((e) => e.forbedring > 0)
    .sort((a, b) => Number(pakkeIder.includes(b.tiltak.id)) - Number(pakkeIder.includes(a.tiltak.id)) || b.forbedring - a.forbedring)
    .slice(0, 4)
    .map((e) => ({
      navn: e.tiltak.navn,
      begrunnelse: e.tiltak.beskrivelse,
      effekt: `Margin til insolvensgrensen ${kr(e.prognose.margin)} (${e.forbedring > 0 ? "+" : ""}${kr(e.forbedring)}). Sannsynlighet ${prosent(e.prognose.sannsynlighetInsolvens)}.`,
      forbehold: e.tiltak.forbehold,
    }));

  return {
    kilde: "mal",
    oppsummering: p.tomKasse.startsWith("nei")
      ? `${kunde.navn} holder seg innenfor rammen de neste 13 ukene, men har ${signaler.length} signaler som bør følges opp.`
      : `Prognosen viser at ${kunde.navn} passerer insolvensgrensen (${fakta.insolvens.grense.split(" (")[0]}) ${p.tomKasse}, med ${fakta.insolvens.sannsynlighetInsolvens} sannsynlighet. På det verste mangler ${kr(-tv.basis.margin)}.${
          tv.pakke ? ` Anbefalt tiltak: ${tv.pakke.tiltak.map((t) => t.navn.toLowerCase()).join(" og ")}.` : ""
        }`,
    hvaHarSkjedd: [
      ...signaler.slice(0, 4).map((s) => ({ punkt: s.forklaring, kilde: `${s.kilde}: ${s.signal}` })),
      ...(sisteNotat ? [{ punkt: `Siste notat: «${sisteNotat.tekst}»`, kilde: `Rådgivernotat ${kortDato(sisteNotat.dato)}` }] : []),
    ],
    sporsmal: [
      "Hvordan ser ordrereserven ut for de neste tre månedene?",
      storste && !storste.internKunde ? `Hvordan er dialogen med ${storste.navn} om betalingene?` : "Hvordan betaler de største kundene deres nå?",
      "Hvilke store utbetalinger har dere de neste ukene, og har dere en plan for dem?",
      "Har dere vurdert tiltak på kostnadssiden?",
      "Er det noe vi i banken bør vite som ikke står i tallene?",
    ],
    tiltak,
    apning: `Hei ${kunde.dagligLeder.split(" ")[0]}, jeg ville ta en prat om hvordan høsten og vinteren ser ut for dere, og om det er noe vi kan hjelpe med i god tid.`,
    ikkeVurdert: [
      ...fakta.signaler.filter((s) => s.poeng === 0).map((s) => `${s.signal}: ${s.forklaring}`),
      ...(kunde.samtykke < 3 ? ["Eierens privatøkonomi (kausjon, boliglån) – krever eget samtykke."] : []),
      ...(sisteNotat ? [] : ["Ingen rådgivernotater."]),
    ],
  };
}
