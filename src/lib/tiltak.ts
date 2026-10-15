// Tiltak som kan hindre at kunden blir betalingsudyktig og misligholder.
// Hvert tiltak er en endring i prognosevalgene, så effekten regnes i kroner.

import type { Kunde } from "./types.ts";
import { DAGENS_DATO, dagerMellom } from "./dato.ts";
import { lagPrognose, STANDARDVALG, type Prognose, type PrognoseValg } from "./prognose.ts";
import { mnok } from "./format.ts";

export type Aktor = "Kunden" | "Banken" | "Skatteetaten" | "Eier";

export interface Tiltak {
  id: string;
  navn: string;
  beskrivelse: string;
  aktor: Aktor;
  inngripen: 1 | 2 | 3; // 1 = lett, 3 = tungt (kostnad, risiko eller krav til eier)
  betalingslettelse: boolean; // må merkes og rapporteres som forbearance
  forbehold: string;
  valg: Partial<PrognoseValg>;
  parameter?: Parameter;
  utilgjengelig?: string;
}

// Justerbart tall for et tiltak eller scenario. «verdi» er det som brukes nå.
export interface Parameter {
  etikett: string;
  enhet: "%" | "kr" | "dager" | "mnd" | "pp";
  standard: number;
  min: number;
  maks: number;
  steg: number;
  verdi: number;
}

export type Parametre = Record<string, number>;

function param(id: string, parametre: Parametre, p: Omit<Parameter, "verdi">): Parameter {
  const onsket = parametre[id];
  const verdi = onsket === undefined || !Number.isFinite(onsket) ? p.standard : Math.min(p.maks, Math.max(p.min, onsket));
  return { ...p, verdi };
}

const rund = (x: number, til = 100_000) => Math.round(x / til) * til;

export function tiltakFor(kunde: Kunde, parametre: Parametre = {}): Tiltak[] {
  const fakturaer = kunde.fakturaer;
  const forfalte = (fakturaer ?? []).filter((f) => dagerMellom(f.forfall, DAGENS_DATO) > 0);
  const tregeDebitorer = kunde.debitorer.some((d) => d.snittDagerForsinkelse > 10);
  const kkBrukt = Math.max(0, -kunde.dagligSaldo[kunde.dagligSaldo.length - 1].saldo);
  const fakturaSum = (fakturaer ?? []).reduce((s, f) => s + f.belop, 0);
  const maksBelop = Math.max(1_000_000, rund(kunde.kassekredittRamme * 2));

  const pInnfordring = param("innfordring", parametre, { etikett: "Innbetalt innen", enhet: "dager", standard: 7, min: 1, maks: 60, steg: 1 });
  const pMva = param("mvaAvtale", parametre, { etikett: "Fordelt på", enhet: "mnd", standard: 3, min: 2, maks: 12, steg: 1 });
  const pKutt = param("kostnadskutt", parametre, { etikett: "Kutt", enhet: "%", standard: 10, min: 1, maks: 50, steg: 1 });
  const pFactoring = param("factoring", parametre, { etikett: "Forskudd", enhet: "%", standard: 80, min: 50, maks: 95, steg: 5 });
  const pKkTilLan = param("kkTilLan", parametre, {
    etikett: "Beløp",
    enhet: "kr",
    standard: Math.max(100_000, rund(Math.min(kkBrukt, kunde.kassekredittRamme) * 0.5, 50_000)),
    min: 50_000,
    maks: Math.max(100_000, rund(kunde.kassekredittRamme, 50_000)),
    steg: 50_000,
  });
  const pRamme = param("rammeokning", parametre, {
    etikett: "Økning",
    enhet: "kr",
    standard: Math.max(100_000, rund(kunde.kassekredittRamme * 0.4, 50_000)),
    min: 50_000,
    maks: maksBelop,
    steg: 50_000,
  });
  const pTilskudd = param("kapitaltilskudd", parametre, {
    etikett: "Beløp",
    enhet: "kr",
    standard: Math.min(1_000_000, Math.max(100_000, rund(kunde.kassekredittRamme * 0.2, 50_000))),
    min: 50_000,
    maks: maksBelop,
    steg: 50_000,
  });

  return [
    {
      id: "innfordring",
      navn: "Aktiv innfordring",
      beskrivelse: forfalte.length
        ? `Purring og dialog om ${mnok(forfalte.reduce((s, f) => s + f.belop, 0))} i forfalte fakturaer, innbetalt innen ${pInnfordring.verdi} dager. Kortere frist på nye.`
        : "Kortere betalingsfrist og tettere oppfølging av nye fakturaer.",
      aktor: "Kunden",
      inngripen: 1,
      betalingslettelse: false,
      forbehold: "Kan belaste kunderelasjoner. Forutsetter at debitorene faktisk kan betale.",
      valg: { innfordring: true, innfordringDager: pInnfordring.verdi },
      parameter: pInnfordring,
      utilgjengelig: fakturaer === undefined ? "Krever samtykke til reskontro" : !forfalte.length && !tregeDebitorer ? "Ingen forfalte fakturaer" : undefined,
    },
    {
      id: "mvaAvtale",
      navn: "Betalingsavtale for MVA",
      beskrivelse: `Søke Skatteetaten om å dele MVA-forfall på ${pMva.verdi} måneder. Forskuddstrekk kan ikke utsettes.`,
      aktor: "Skatteetaten",
      inngripen: 2,
      betalingslettelse: false,
      forbehold: "Skatteetaten må innvilge, og det påløper forsinkelsesrente.",
      valg: { mvaAvtale: true, mvaAvtaleMnd: pMva.verdi },
      parameter: pMva,
      utilgjengelig: kunde.faste.mvaAndelAvOmsetning === 0 ? "Kunden er ikke MVA-pliktig" : undefined,
    },
    {
      id: "avdragsfrihet",
      navn: "Avdragsfrihet i 6 måneder",
      beskrivelse: kunde.lan.length ? `Kun renter på ${kunde.lan.map((l) => l.navn.toLowerCase()).join(" og ")}. Sparer ${mnok(kunde.lan.reduce((s, l) => s + l.avdragPerMnd, 0) * 3)} i perioden.` : "",
      aktor: "Banken",
      inngripen: 2,
      betalingslettelse: true,
      forbehold: "Betalingslettelse som må merkes og rapporteres. Forlenger nedbetalingstiden.",
      valg: { avdragsfrihet: true },
      utilgjengelig: kunde.lan.length ? undefined : "Kunden har ingen lån",
    },
    {
      id: "kostnadskutt",
      navn: "Kostnadstiltak",
      beskrivelse: `${pKutt.verdi} % kutt i innkjøp og variable kostnader fra uke 3, f.eks. utsatte innkjøp og færre innleide.`,
      aktor: "Kunden",
      inngripen: 2,
      betalingslettelse: false,
      forbehold: "Tar tid å få effekt og kan redusere kapasiteten.",
      valg: { kostnadskutt: pKutt.verdi / 100 },
      parameter: pKutt,
    },
    {
      id: "factoring",
      navn: "Løpende factoring",
      beskrivelse: fakturaSum ? `${pFactoring.verdi} % forskudd på utestående (${mnok(fakturaSum)}) og nye fakturaer. Gebyr 1,5 %.` : "",
      aktor: "Banken",
      inngripen: 2,
      betalingslettelse: false,
      forbehold: "Koster gebyr. Debitorene må godkjennes, og svært gamle fakturaer kan bli avvist.",
      valg: { factoring: true, factoringForskudd: pFactoring.verdi / 100 },
      parameter: pFactoring,
      utilgjengelig: fakturaer === undefined ? "Krever samtykke til reskontro" : fakturaSum === 0 ? "Ingen utestående fakturaer" : undefined,
    },
    {
      id: "kkTilLan",
      navn: "Gjør kassekreditt om til nedbetalingslån",
      beskrivelse: `${mnok(pKkTilLan.verdi)} av kassekreditten flyttes til et 5-årig lån. Frigjør ramme, gir faste terminer.`,
      aktor: "Banken",
      inngripen: 3,
      betalingslettelse: true,
      forbehold: "Refinansiering pga. betalingsproblemer er en betalingslettelse. Krever kredittvurdering.",
      valg: { kkTilLan: pKkTilLan.verdi },
      parameter: pKkTilLan,
      utilgjengelig: kkBrukt < Math.max(100_000, kunde.kassekredittRamme * 0.3) ? "Kassekreditten er lite brukt" : undefined,
    },
    {
      id: "rammeokning",
      navn: "Midlertidig økt ramme",
      beskrivelse: `+${mnok(pRamme.verdi)} på kassekreditten i 3 måneder.`,
      aktor: "Banken",
      inngripen: 3,
      betalingslettelse: true,
      forbehold: "Øker bankens eksponering og løser ikke grunnproblemet. Bør kobles til en plan og ev. sikkerhet.",
      valg: { rammeokning: pRamme.verdi },
      parameter: pRamme,
    },
    {
      id: "kapitaltilskudd",
      navn: "Kapitaltilskudd fra eier",
      beskrivelse: `Eier skyter inn ${mnok(pTilskudd.verdi)} om to uker.`,
      aktor: "Eier",
      inngripen: 3,
      betalingslettelse: false,
      forbehold: "Avhenger av eierens private økonomi (krever samtykke nivå 3 for å vurdere).",
      valg: { kapitaltilskudd: pTilskudd.verdi },
      parameter: pTilskudd,
    },
  ];
}

export interface TiltakEffekt {
  tiltak: Tiltak;
  prognose: Prognose;
  forbedring: number; // endring i margin mot insolvensgrensen
}

export interface Tiltaksvurdering {
  basis: Prognose;
  effekter: TiltakEffekt[];
  pakke: { tiltak: Tiltak[]; valg: PrognoseValg; prognose: Prognose } | null;
  buffer: number;
}

function kombiner(scenario: PrognoseValg, tiltak: Tiltak[]): PrognoseValg {
  return tiltak.reduce((v, t) => ({ ...v, ...t.valg }), { ...scenario });
}

// Vurderer hvert tiltak for seg (gitt valgt scenario), og setter sammen den letteste
// pakken som holder kunden over insolvensgrensen med en sikkerhetsmargin.
export function vurderTiltak(kunde: Kunde, scenario: PrognoseValg = STANDARDVALG, parametre: Parametre = {}): Tiltaksvurdering {
  const basis = lagPrognose(kunde, scenario);
  const buffer = Math.max(100_000, kunde.kassekredittRamme * 0.05);
  const tilgjengelige = tiltakFor(kunde, parametre).filter((t) => !t.utilgjengelig);

  const effekter = tilgjengelige.map((t) => {
    const prognose = lagPrognose(kunde, kombiner(scenario, [t]));
    return { tiltak: t, prognose, forbedring: prognose.margin - basis.margin };
  });

  if (basis.margin >= buffer && basis.sannsynlighetInsolvens < 0.2) return { basis, effekter, pakke: null, buffer };

  const kandidater = [...effekter]
    .filter((e) => e.forbedring > kunde.kassekredittRamme * 0.02)
    .sort((a, b) => a.tiltak.inngripen - b.tiltak.inngripen || b.forbedring - a.forbedring);

  const valgte: Tiltak[] = [];
  let naa = basis;
  for (const k of kandidater) {
    if (naa.margin >= buffer || valgte.length >= 4) break;
    const forsok = lagPrognose(kunde, kombiner(scenario, [...valgte, k.tiltak]));
    if (forsok.margin - naa.margin > kunde.kassekredittRamme * 0.02) {
      valgte.push(k.tiltak);
      naa = forsok;
    }
  }
  return valgte.length ? { basis, effekter, pakke: { tiltak: valgte, valg: kombiner(scenario, valgte), prognose: naa }, buffer } : { basis, effekter, pakke: null, buffer };
}
