// Muligheter: gode grunner til å ta kontakt, i tillegg til risikovarslene.
// «Én radar, to retninger»: samme data som varsler skvis, viser også når kunden trenger
// finansiering av vekst, garantier eller plassering av overskuddslikviditet.
// Bare signaler med dato og kilde i datagrunnlaget, eller tall fra regnskap og bankdata.
// Kunder i en sensitiv situasjon eller i krise (Kritisk) får ingen muligheter: banken selger ikke da.

import type { Kunde } from "./types.ts";
import type { Vurdering } from "./score.ts";
import { kortDato } from "./dato.ts";
import { mnok, prosent } from "./format.ts";

export type Mulighetstype = "kontrakt" | "investering" | "vekst" | "plassering" | "bemanning" | "generasjon";

export interface Mulighet {
  id: string;
  kundeId: string;
  type: Mulighetstype;
  tittel: string;
  grunn: string; // hva vi ser, med tall fra kilden
  tilbud: string; // hva banken kan tilby
  kilde: string;
  dato?: string;
  verdi: number; // kontaktverdi 1–5, for sortering
}

export const MULIGHET_ETIKETT: Record<Mulighetstype, string> = {
  kontrakt: "Ny kontrakt",
  investering: "Utbygging",
  vekst: "Vekst",
  plassering: "Ledig likviditet",
  bemanning: "Flere ansatte",
  generasjon: "Generasjonsskifte",
};

// Vekst som binder likviditet: minst 15 % omsetningsvekst, overskudd og høyt trekk på kassekreditten
const VEKST_MIN = 0.15;
const UTNYTTELSE_MIN = 0.6;

export function muligheterFor(kunde: Kunde, v: Vurdering): Mulighet[] {
  if (kunde.sensitiv || v.niva === "Kritisk") return [];
  const m: Mulighet[] = [];
  const ny = (x: Omit<Mulighet, "id" | "kundeId">) => m.push({ ...x, id: `${x.type}-${kunde.id}`, kundeId: kunde.id });

  for (const t of kunde.tekster) {
    // Offentlig kontrakt (Doffin) som krever kontraktsgaranti
    if (t.tittel === "Kontrakt" && /Tildelt offentleg kontrakt/.test(t.tekst)) {
      const verdi = t.tekst.match(/estimert ([\d,]+) mill\. over (\d+) år/);
      const navn = t.tekst.match(/kontrakt: (.+?), estimert/)?.[1];
      ny({
        type: "kontrakt",
        tittel: "Ny offentlig kontrakt",
        grunn: `Tildelt ${navn ? `«${navn}»` : "offentlig kontrakt"}${verdi ? `, ${verdi[1]} MNOK over ${verdi[2]} år` : ""}. ${/kontraktsgaranti/i.test(t.tekst) ? "Krever kontraktsgaranti." : ""}`.trim(),
        tilbud: "Kontraktsgaranti, og arbeidskapital til oppstarten før de første innbetalingene kommer.",
        kilde: t.avsender,
        dato: t.dato,
        verdi: 5,
      });
    }
    // Byggesak: utbygging som må finansieres
    if (t.tittel === "Byggjesak" && /Rammeløyve godkjent/.test(t.tekst)) {
      const tiltak = t.tekst.match(/Rammeløyve godkjent: (.+?)\./)?.[1];
      const sokjar = t.tekst.match(/Søkjar: (.+?) \(same eigar\)/)?.[1];
      ny({
        type: "investering",
        tittel: "Utbygging godkjent",
        grunn: `Rammetillatelse godkjent${tiltak ? `: ${tiltak}` : ""}.${sokjar ? ` Søkt av eiendomsselskapet med samme eier (${sokjar}).` : ""}`,
        tilbud: "Byggelån og langsiktig finansiering av utbyggingen, slik at driftskreditten ikke brukes til investeringen.",
        kilde: t.avsender,
        dato: t.dato,
        verdi: 4,
      });
    }
    // Overskuddslikviditet uten plassering
    if (t.tittel === "Likviditet" && /Ingen plasseringskonto/.test(t.tekst)) {
      const saldo = kunde.dagligSaldo.slice(-90).reduce((s, d) => s + d.saldo, 0) / 90;
      ny({
        type: "plassering",
        tittel: "Ledig likviditet uten plassering",
        grunn: `Snittsaldo siste 90 dager er ${mnok(saldo)}, og kunden har ingen plasseringskonto.`,
        tilbud: "Plasseringskonto eller fastrenteinnskudd for den delen som ikke trengs i driften.",
        kilde: t.avsender,
        dato: t.dato,
        verdi: 3,
      });
    }
    // Flere ansatte: lønnskostnaden vokser
    if (t.tittel === "Bemanning") {
      const tall = t.tekst.match(/auka frå (\d+) til (\d+)/);
      ny({
        type: "bemanning",
        tittel: "Flere ansatte",
        grunn: tall ? `Antall ansatte økt fra ${tall[1]} til ${tall[2]} siste 12 måneder.` : t.tekst,
        tilbud: "Sjekk at kassekreditten følger den høyere lønnskostnaden, og tilby pensjons- og forsikringsordning for de nye.",
        kilde: t.avsender,
        dato: t.dato,
        verdi: 3,
      });
    }
    // Generasjonsskifte i ledelsen
    if (t.tittel === "Roller" && /neste generasjon/.test(t.tekst)) {
      ny({
        type: "generasjon",
        tittel: "Generasjonsskifte",
        grunn: "Ny daglig leder fra neste generasjon. Tidligere daglig leder fortsetter som styreleder og hovedeier.",
        tilbud: "Rådgivning om eierskifte og finansiering av et senere oppkjøp av aksjene.",
        kilde: t.avsender,
        dato: t.dato,
        verdi: 2,
      });
    }
  }

  // Vekst som binder likviditet (fra regnskap og bankdata)
  const o = kunde.regnskapIFjor.omsetning;
  if (o.length >= 2 && o[o.length - 2].belop > 0) {
    const vekst = o[o.length - 1].belop / o[o.length - 2].belop - 1;
    if (vekst >= VEKST_MIN && kunde.regnskapIFjor.driftsresultat > 0 && v.kkUtnyttelse >= UTNYTTELSE_MIN) {
      ny({
        type: "vekst",
        tittel: "Vekst som binder likviditet",
        grunn: `Omsetningen økte ${prosent(vekst)} fra ${o[o.length - 2].aar} til ${o[o.length - 1].aar} med overskudd (${mnok(kunde.regnskapIFjor.driftsresultat)}), men kassekreditten er ${prosent(v.kkUtnyttelse)} brukt i dag.`,
        tilbud: "Finansiering av arbeidskapital (økt ramme, factoring eller vekstlån) før veksten gir skvis.",
        kilde: "Regnskap og bankdata",
        verdi: v.kkUtnyttelse >= 0.8 ? 4 : 3,
      });
    }
  }

  return m.sort((a, b) => b.verdi - a.verdi);
}

export function kildeTekst(x: Mulighet): string {
  return `${x.kilde}${x.dato ? ` · ${kortDato(x.dato)}` : ""}`;
}
