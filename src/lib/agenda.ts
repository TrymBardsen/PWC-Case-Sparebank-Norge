// Dagens agenda: gjør porteføljevurderingen om til 3–6 konkrete oppgaver med neste handling,
// ferdig forslag til melding og et anslag på hvor mye forberedelsestid som spares.

import type { Kunde } from "./types.ts";
import type { Smitte, Vurdering } from "./score.ts";
import type { GronnVurdering } from "./gronn.ts";
import { dagerSiden, kortDato, visDatoer } from "./dato.ts";
import { antall, kr, mnok, omUker, prosent } from "./format.ts";
import { KATEGORI_POENG, KATEGORI_TEKST } from "./tekst.ts";
import { vurderTiltak } from "./tiltak.ts";
import { kortForslag, nesteHandling } from "./neste.ts";
import { muligheterFor, type Mulighet } from "./muligheter.ts";

export type Oppgavetype = "ring" | "folgopp" | "sjekkinn" | "eksponering" | "gronn" | "mulighet" | "mote" | "oppfolging" | "delt";

export interface Oppgave {
  id: string;
  kundeId: string;
  kundenavn: string;
  kontakt: string;
  type: Oppgavetype;
  tittel: string;
  grunn: string;
  forslag?: string;
  frist: string; // «I dag», «Denne uken» eller «Forfalt 3. okt»
  minutterUten: number; // forberedelse uten verktøyet (analyse, prognose, tiltak)
  minutterMed: number;
  melding: string; // forhåndsutfylt sjekk-inn-melding
}

const fornavn = (navn: string) => navn.split(" ")[0];

export function lagAgenda(
  kunder: Kunde[],
  vurderinger: Map<string, Vurdering>,
  smitte: Smitte[],
  gronn: Map<string, GronnVurdering>,
): Oppgave[] {
  const oppgaver: Oppgave[] = [];
  const brukt = new Set<string>();
  const sortert = [...kunder].sort((a, b) => vurderinger.get(b.id)!.score - vurderinger.get(a.id)!.score);
  const signatur = `\n\nVennlig hilsen\n${kunder[0]?.radgiver ?? "Rådgiver"}\nBedriftsrådgiver, BM Bergen`;
  // Kunder i en sensitiv situasjon (f.eks. etter dødsfall) får ingen oppgaver her: banken har lovet bare praktisk kontakt
  const sensitive = new Set(kunder.filter((k) => k.sensitiv).map((k) => k.id));

  // 1. Kritiske og høye kunder
  for (const k of sortert) {
    const v = vurderinger.get(k.id)!;
    if ((v.niva !== "Kritisk" && v.niva !== "Høy") || sensitive.has(k.id)) continue;
    const p = v.prognose;
    const dager = dagerSiden(k.sisteKontakt) ?? Infinity;
    const tv = vurderTiltak(k);
    const pakke = tv.pakke;
    const neste = nesteHandling(k, v, tv);
    // Dager under grensen skiller kunder som alle har høy sannsynlighet
    const grense = p.tomKasseDato
      ? `Passerer insolvensgrensen ${kortDato(p.tomKasseDato)} (${omUker(p.ukerTilTomKasse!)}). ${antall(p.dagerUnderGrensen, "dag", "dager")} under grensen i prognosen, ${prosent(p.sannsynlighetInsolvens)} modellsannsynlighet`
      : `${prosent(p.sannsynlighetInsolvens)} modellsannsynlighet for å passere insolvensgrensen`;
    const tekst = v.faktorer.find((f) => f.id === "tekst" && f.poeng > 0);
    if (dager > 14) {
      oppgaver.push({
        id: `ring-${k.id}`,
        kundeId: k.id,
        kundenavn: k.navn,
        kontakt: k.dagligLeder,
        type: "ring",
        tittel: `Ring ${fornavn(k.dagligLeder)} i ${k.navn}`,
        grunn: `${grense}. ${Number.isFinite(dager) ? `Ikke kontaktet på ${dager} dager.` : "Ingen registrert kontakt."}${tekst ? ` ${visDatoer(tekst.forklaring)}` : ""}`,
        forslag: pakke ? `${kortForslag(neste)}${pakke.prognose.margin < 0 ? " – tiltakene er ikke nok alene" : ""}` : undefined,
        frist: "I dag",
        minutterUten: 75,
        minutterMed: 10,
        melding: `Hei ${fornavn(k.dagligLeder)}.\n\nJeg ser over kundene mine før vinteren og vil gjerne ta en prat om hvordan de neste månedene ser ut for dere, særlig rundt lønn og MVA i november og desember. Har du tid til en telefon i dag eller i morgen?${signatur}`,
      });
    } else {
      oppgaver.push({
        id: `folgopp-${k.id}`,
        kundeId: k.id,
        kundenavn: k.navn,
        kontakt: k.dagligLeder,
        type: "folgopp",
        tittel: `Følg opp ${k.navn}`,
        grunn: `${grense}. Kontaktet for ${dager} dager siden.`,
        forslag: pakke
          ? pakke.prognose.margin >= 0
            ? kortForslag(neste)
            : `Tiltakene er ikke nok (mangler ${kr(-pakke.prognose.margin)}). Vurder spesialenhet.`
          : undefined,
        frist: "I dag",
        minutterUten: 45,
        minutterMed: 10,
        melding: `Hei ${fornavn(k.dagligLeder)}.\n\nTakk for sist. Jeg har sett nærmere på tallene og har noen forslag til hvordan vi kan komme gjennom de neste ukene. Kan vi ta et kort møte denne uken?${signatur}`,
      });
    }
    brukt.add(k.id);
  }

  // 2. Kunder der teksten viser noe tallene ikke viser ennå
  for (const k of sortert) {
    if (brukt.has(k.id) || sensitive.has(k.id)) continue;
    const v = vurderinger.get(k.id)!;
    const tekst = v.faktorer.find((f) => f.id === "tekst");
    const sterkest = [...v.tekstanalyse.signaler].sort((a, b) => KATEGORI_POENG[b.kategori] * b.alvor - KATEGORI_POENG[a.kategori] * a.alvor)[0];
    if (!tekst || tekst.poeng < 6 || !sterkest) continue;
    // Taushetsplikt: meldingen til kunden nevner aldri andre kunder i banken ved navn
    const kildetype = k.tekster.find((t) => t.id === sterkest.kildeId)?.type;
    const debitor = k.debitorer.find((d) => d.navn === sterkest.gjelderDebitor);
    const omtale = debitor && !debitor.internKunde ? debitor.navn : "en av de største kundene deres";
    const apning =
      kildetype === "epost"
        ? "Takk for e-posten din. Jeg vil gjerne se på dette sammen med deg før det blir prekært."
        : `Jeg så nyheten om ${omtale} og ville høre hvordan det påvirker dere.`;
    oppgaver.push({
      id: `sjekkinn-${k.id}`,
      kundeId: k.id,
      kundenavn: k.navn,
      kontakt: k.dagligLeder,
      type: "sjekkinn",
      tittel: `Sjekk inn med ${fornavn(k.dagligLeder)} i ${k.navn}`,
      grunn: `${KATEGORI_TEKST[sterkest.kategori]}. ${sterkest.oppsummering} Tallene viser det ikke ennå. Fra kilden: «${visDatoer(sterkest.sitat)}»`,
      frist: "Denne uken",
      minutterUten: 30,
      minutterMed: 5,
      melding: `Hei ${fornavn(k.dagligLeder)}.\n\n${apning} Har du tid til en kort prat denne uken?${signatur}`,
    });
    brukt.add(k.id);
  }

  // 3. Smitte: underleverandører til kunder i krise
  for (const s of smitte) {
    if (brukt.has(s.til) || sensitive.has(s.til) || (vurderinger.get(s.fra)?.score ?? 0) < 50) continue;
    const til = kunder.find((k) => k.id === s.til)!;
    const fra = kunder.find((k) => k.id === s.fra)!;
    oppgaver.push({
      id: `eksponering-${til.id}`,
      kundeId: til.id,
      kundenavn: til.navn,
      kontakt: til.dagligLeder,
      type: "eksponering",
      tittel: `Avklar eksponering mot ${fra.navn} med ${til.navn}`,
      grunn: `${prosent(s.andel)} av innbetalingene kommer fra ${fra.navn}, som nå betaler ${s.forsinkelse} dager etter forfall.`,
      forslag: `Vurder factoring eller kredittforsikring på fakturaene mot ${fra.navn}.`,
      frist: "Denne uken",
      minutterUten: 40,
      minutterMed: 5,
      melding: `Hei ${fornavn(til.dagligLeder)}.\n\nJeg vil gjerne høre hvordan det går med betalingene fra de største kundene deres, og om dere trenger noe fra oss før lønn i november. Passer det med en prat?${signatur}`,
    });
    brukt.add(til.id);
  }

  // 4. Grønn mulighet: nødvendig og gjennomførbar, raskest tilbakebetalt
  const beste = [...gronn.entries()].filter(([id, g]) => g.gjennomforbar && !brukt.has(id) && !sensitive.has(id)).sort((a, b) => b[1].nodvendig.length - a[1].nodvendig.length || a[1].tilbakebetalingAar - b[1].tilbakebetalingAar)[0];
  if (beste) {
    const [id, g] = beste;
    const k = kunder.find((x) => x.id === id)!;
    oppgaver.push({
      id: `gronn-${id}`,
      kundeId: id,
      kundenavn: k.navn,
      kontakt: k.dagligLeder,
      type: "gronn",
      tittel: `Foreslå ${g.navn.toLowerCase()} til ${k.navn}`,
      grunn: `${g.nodvendig[0] ?? "Energiintensiv drift."} Sparer ${kr(g.besparelsePerAar)} i året, tilbakebetalt på ${g.tilbakebetalingAar.toFixed(1).replace(".", ",")} år.`,
      forslag: `Grønt lån ${mnok(g.lanebelop)} + Enova-støtte ${mnok(g.enovaStotte)}. Netto ${kr(g.nettoPerAar)} i året etter termin.`,
      frist: "Denne uken",
      minutterUten: 90,
      minutterMed: 10,
      melding: `Hei ${fornavn(k.dagligLeder)}.\n\nVi har sett på energibruken deres og tror ${g.navn.toLowerCase()} kan spare dere rundt ${kr(g.besparelsePerAar)} i året. Med grønt lån og Enova-støtte kan det gjøres uten å belaste likviditeten. Skal vi se på det sammen?${signatur}`,
    });
    brukt.add(id);
  }

  // 5. Gode grunner til kontakt: de to mulighetene med høyest kontaktverdi (aldri kunder i krise eller sensitiv situasjon)
  const muligheter = sortert
    .filter((k) => !brukt.has(k.id))
    .flatMap((k) => muligheterFor(k, vurderinger.get(k.id)!))
    .filter((m) => m.verdi >= 4)
    .sort((a, b) => b.verdi - a.verdi);
  for (const m of muligheter) {
    if (brukt.has(m.kundeId)) continue;
    const k = kunder.find((x) => x.id === m.kundeId)!;
    oppgaver.push({
      id: `mulighet-${m.id}`,
      kundeId: k.id,
      kundenavn: k.navn,
      kontakt: k.dagligLeder,
      type: "mulighet",
      tittel: `${m.tittel}: ta kontakt med ${k.navn}`,
      grunn: m.grunn,
      forslag: m.tilbud,
      frist: "Denne uken",
      minutterUten: 30,
      minutterMed: 5,
      melding: `Hei ${fornavn(k.dagligLeder)}.\n\n${MELDING[m.type]} Har du tid til en kort prat denne uken?${signatur}`,
    });
    brukt.add(k.id);
    if (oppgaver.filter((o) => o.type === "mulighet").length >= 2) break;
  }

  // 6. Glemte kunder med signaler
  for (const k of sortert) {
    if (brukt.has(k.id) || sensitive.has(k.id)) continue;
    const v = vurderinger.get(k.id)!;
    const dagerKontakt = dagerSiden(k.sisteKontakt);
    const dager = dagerKontakt ?? Infinity;
    if (dager <= 365 || v.score < 15) continue;
    oppgaver.push({
      id: `mote-${k.id}`,
      kundeId: k.id,
      kundenavn: k.navn,
      kontakt: k.dagligLeder,
      type: "mote",
      tittel: `Book møte med ${k.navn}`,
      grunn: `${dagerKontakt === null ? "Ingen registrert kontakt." : `Ikke kontaktet på ${dager} dager.`} ${v.faktorer.filter((f) => f.poeng > 0 && f.id !== "kontakt").sort((a, b) => b.poeng - a.poeng)[0]?.forklaring ?? ""}`,
      frist: "Denne uken",
      minutterUten: 20,
      minutterMed: 5,
      melding: `Hei ${fornavn(k.dagligLeder)}.\n\nDet er en stund siden sist, og jeg vil gjerne bli bedre kjent med virksomheten deres. Har du tid til et kort møte i løpet av de neste ukene?${signatur}`,
    });
    brukt.add(k.id);
    if (oppgaver.length >= 7) break;
  }

  return oppgaver.slice(0, 7);
}

// Åpning i meldingen til kunden. Nevner aldri andre kunder eller selskaper ved navn.
const MELDING: Record<Mulighet["type"], string> = {
  kontrakt: "Gratulerer med den nye kontrakten! Vi hjelper gjerne med kontraktsgarantien og finansieringen av oppstarten, så likviditeten ikke blir for stram.",
  investering: "Jeg ser at utbyggingen deres er godkjent. Vi vil gjerne se på finansieringen sammen med dere, så driften ikke må bære investeringen.",
  vekst: "Dere har hatt sterk vekst det siste året. Vi vil gjerne sikre at finansieringen henger med, slik at veksten ikke spiser opp likviditeten.",
  plassering: "Dere har hatt god likviditet over lengre tid. Vi kan se på om en del av den kan gi bedre avkastning uten å binde opp det dere trenger i driften.",
  bemanning: "Dere har blitt flere ansatte det siste året. Jeg vil gjerne høre om kassekreditten og ordningene deres fortsatt passer størrelsen.",
  generasjon: "Gratulerer med ny daglig leder. Vi stiller gjerne opp med rådgivning rundt eierskifte når dere kommer dit.",
};
