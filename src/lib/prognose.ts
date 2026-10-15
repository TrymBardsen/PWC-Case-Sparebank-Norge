// 13-ukers likviditetsprognose. Bevisst regelbasert: hver krone i prognosen kan
// spores tilbake til en historisk trend, en kjent utbetaling eller en faktura.

import type { Kunde } from "./types.ts";
import { DAGENS_DATO, dagerMellom, leggTilDager, tilDato, ukedag } from "./dato.ts";
import { kjentePoster, type Kategori } from "./kalender.ts";

export interface PrognoseValg {
  renteTillegg: number; // 0.01 = +1 prosentpoeng
  storsteKundeForsinkelse: number; // dager
  stromFaktor: number; // 1.5 = +50 %
  omsetningsfall: number; // 0.2 = -20 %
  factoring: boolean;
  rammeokning: number;
  avdragsfrihet: boolean;
}

export const STANDARDVALG: PrognoseValg = {
  renteTillegg: 0,
  storsteKundeForsinkelse: 0,
  stromFaktor: 1,
  omsetningsfall: 0,
  factoring: false,
  rammeokning: 0,
  avdragsfrihet: false,
};

export interface UkePost {
  navn: string;
  belop: number; // positivt = inn, negativt = ut
  kategori: Kategori | "salg" | "faktura" | "variabel" | "restanse" | "kkrente" | "factoring";
  dato?: string;
}

export interface PrognoseUke {
  nr: number;
  fra: string;
  inn: number;
  ut: number;
  sluttSaldo: number;
  minSaldo: number;
  lav: number; // usikkerhetsbånd
  hoy: number;
  poster: UkePost[];
}

export interface Prognose {
  startSaldo: number;
  ramme: number;
  uker: PrognoseUke[];
  dager: { dato: string; saldo: number; bredde: number }[];
  tomKasseDato: string | null;
  ukerTilTomKasse: number | null;
  lavesteSaldo: number;
  lavesteDato: string;
  brukerReskontro: boolean;
  innEndring: number; // siste 6 uker mot samme nivå 3–6 mnd siden, sesongjustert
  storsteDebitor: string;
  storsteDebitorAndel: number;
  usikkerhet: number; // relativ bredde på båndet
}

const UKER = 13;
const BLANDING_DAGER = 28; // de første fire ukene erstatter fakturaene det meste av historikken
const ANDEL_KONTANT_NAR_RESKONTRO = 0.2;

function sesongFor(kunde: Kunde, iso: string): number {
  return kunde.sesongprofil[tilDato(iso).getUTCMonth()];
}

function sesongjustertSnitt(kunde: Kunde, uker: Kunde["historikk"], felt: "inn" | "utVariabel"): number {
  if (uker.length === 0) return 0;
  const sum = uker.reduce((s, u) => s + u[felt] / sesongFor(kunde, leggTilDager(u.fra, 3)), 0);
  return sum / uker.length;
}

export function innEndring(kunde: Kunde): number {
  const h = kunde.historikk;
  const na = sesongjustertSnitt(kunde, h.slice(-6), "inn");
  const for_ = sesongjustertSnitt(kunde, h.slice(-26, -13), "inn");
  return for_ > 0 ? na / for_ - 1 : 0;
}

export function lagPrognose(kunde: Kunde, valg: PrognoseValg = STANDARDVALG): Prognose {
  const start = DAGENS_DATO;
  const slutt = leggTilDager(start, UKER * 7);
  const ramme = kunde.kassekredittRamme + valg.rammeokning;
  const startSaldo = kunde.dagligSaldo[kunde.dagligSaldo.length - 1].saldo;

  const siste8 = kunde.historikk.slice(-8);
  const nivaInn = sesongjustertSnitt(kunde, siste8, "inn") * (1 - valg.omsetningsfall);
  const nivaUt = sesongjustertSnitt(kunde, siste8, "utVariabel") * (1 - valg.omsetningsfall * 0.5);

  const fakturaer = kunde.fakturaer ?? [];
  const brukerReskontro = fakturaer.length > 0;
  const blandingSlutt = brukerReskontro ? leggTilDager(start, BLANDING_DAGER) : start;

  const storste = [...kunde.debitorer].sort((a, b) => b.andelAvInnbetalinger - a.andelAvInnbetalinger)[0];
  const forsinkelseSlutt = leggTilDager(blandingSlutt, valg.storsteKundeForsinkelse);

  // Hendelser per dag
  const hendelser = new Map<string, UkePost[]>();
  const leggTil = (dato: string, post: UkePost) => {
    if (dato < start || dato >= slutt) return;
    const liste = hendelser.get(dato) ?? [];
    liste.push({ ...post, dato });
    hendelser.set(dato, liste);
  };

  // 1. Normal drift fra historikken
  for (let iso = start; iso < slutt; iso = leggTilDager(iso, 1)) {
    if (ukedag(iso) >= 5) continue;
    const s = sesongFor(kunde, iso);
    let inn = (nivaInn * s) / 5;
    if (iso < blandingSlutt) inn *= ANDEL_KONTANT_NAR_RESKONTRO;
    if (valg.storsteKundeForsinkelse > 0 && iso >= blandingSlutt && iso < forsinkelseSlutt) {
      inn *= 1 - storste.andelAvInnbetalinger;
    }
    leggTil(iso, { navn: brukerReskontro && iso < blandingSlutt ? "Kontantsalg (anslag)" : "Innbetalinger (normalnivå)", belop: inn, kategori: "salg" });
    // Løpende factoring: nye fakturaer gir 80 % forskudd med en gang i stedet for etter ~30 dager.
    // I overgangsmåneden kommer derfor én ekstra måned med forskudd, deretter et gebyr på 1,5 %.
    if (valg.factoring && brukerReskontro && iso >= blandingSlutt) {
      if (iso < leggTilDager(blandingSlutt, 30)) leggTil(iso, { navn: "Factoring: forskudd på nye fakturaer", belop: inn * 0.8, kategori: "factoring" });
      leggTil(iso, { navn: "Factoringgebyr (1,5 %)", belop: -inn * 0.015, kategori: "factoring" });
    }
    leggTil(iso, { navn: "Varekjøp og variable kostnader", belop: -(nivaUt * s) / 5, kategori: "variabel" });
  }

  // 2. Utestående fakturaer fra reskontro
  let factoringUtbetalt = 0;
  for (const f of fakturaer) {
    const debitor = kunde.debitorer.find((d) => d.navn === f.debitor);
    let forventet = leggTilDager(f.forfall, debitor?.snittDagerForsinkelse ?? 7);
    if (forventet < leggTilDager(start, 3)) forventet = leggTilDager(start, 3 + (dagerMellom(f.forfall, start) > 30 ? 14 : 0));
    if (debitor && debitor.navn === storste.navn) forventet = leggTilDager(forventet, valg.storsteKundeForsinkelse);
    if (valg.factoring) {
      factoringUtbetalt += f.belop * 0.8;
      leggTil(forventet, { navn: `Restbetaling factoring: ${f.debitor}`, belop: f.belop * 0.2 - f.belop * 0.015, kategori: "factoring" });
    } else {
      leggTil(forventet, { navn: `Faktura: ${f.debitor}`, belop: f.belop, kategori: "faktura" });
    }
  }
  if (factoringUtbetalt > 0) {
    leggTil(leggTilDager(start, 3), { navn: "Factoring: forskudd på fakturaer (80 %)", belop: factoringUtbetalt, kategori: "factoring" });
  }

  // 3. Kjente utbetalinger
  const estimertInnPerMnd = nivaInn * 4.33;
  for (const p of kjentePoster(kunde, start, slutt, {
    estimertInnPerMnd,
    stromFaktor: valg.stromFaktor,
    renteTillegg: valg.renteTillegg,
    utenAvdrag: valg.avdragsfrihet,
  })) {
    leggTil(p.dato, { navn: p.navn, belop: -p.belop, kategori: p.kategori });
  }

  // 4. Restanser og forfalt gjeld som må gjøres opp
  for (const lan of kunde.lan) {
    if (lan.forfaltBelop > 0) leggTil(leggTilDager(start, 5), { navn: `Forfalte terminer: ${lan.navn}`, belop: -lan.forfaltBelop, kategori: "restanse" });
  }
  if (kunde.restanser) {
    if (kunde.restanser.mva > 0) leggTil(leggTilDager(start, 10), { navn: "MVA-restanse", belop: -kunde.restanser.mva, kategori: "restanse" });
    if (kunde.restanser.forskuddstrekkOgAga > 0)
      leggTil(leggTilDager(start, 10), { navn: "Restanse forskuddstrekk/AGA", belop: -kunde.restanser.forskuddstrekkOgAga, kategori: "restanse" });
  }
  if (kunde.forfaltLeverandorgjeld) {
    for (let i = 0; i < 3; i++) {
      leggTil(leggTilDager(start, 4 + i * 7), { navn: "Forfalt leverandørgjeld (nedbetaling)", belop: -kunde.forfaltLeverandorgjeld / 3, kategori: "restanse" });
    }
  }

  // Simuler dag for dag
  const dager: { dato: string; saldo: number; bredde: number }[] = [];
  // Usikkerhetsbånd: vokser med tiden, smalere når vi ser fakturaene
  const usikkerhet = brukerReskontro ? 0.06 : 0.12;
  let kumulertInn = 0;
  const uker: PrognoseUke[] = [];
  let saldo = startSaldo;
  let kkRenteAkkumulert = 0;
  let tomKasseDato: string | null = null;
  let lavesteSaldo = startSaldo;
  let lavesteDato = start;
  const renteKk = kunde.kassekredittRente + valg.renteTillegg;

  for (let u = 0; u < UKER; u++) {
    const fra = leggTilDager(start, u * 7);
    const uke: PrognoseUke = { nr: u + 1, fra, inn: 0, ut: 0, sluttSaldo: 0, minSaldo: Infinity, lav: 0, hoy: 0, poster: [] };
    for (let d = 0; d < 7; d++) {
      const iso = leggTilDager(fra, d);
      for (const h of hendelser.get(iso) ?? []) {
        saldo += h.belop;
        if (h.belop >= 0) {
          uke.inn += h.belop;
          kumulertInn += h.belop;
        }
        else uke.ut -= h.belop;
        uke.poster.push(h);
      }
      if (saldo < 0) kkRenteAkkumulert += (-saldo * renteKk) / 365;
      const imorgen = leggTilDager(iso, 1);
      if (tilDato(imorgen).getUTCDate() === 1 && kkRenteAkkumulert > 0) {
        saldo -= kkRenteAkkumulert;
        uke.ut += kkRenteAkkumulert;
        uke.poster.push({ navn: "Renter kassekreditt", belop: -kkRenteAkkumulert, kategori: "kkrente", dato: iso });
        kkRenteAkkumulert = 0;
      }
      dager.push({ dato: iso, saldo: Math.round(saldo), bredde: Math.round(kumulertInn * usikkerhet) });
      uke.minSaldo = Math.min(uke.minSaldo, saldo);
      if (saldo < lavesteSaldo) {
        lavesteSaldo = saldo;
        lavesteDato = iso;
      }
      if (tomKasseDato === null && saldo < -ramme) tomKasseDato = iso;
    }
    uke.sluttSaldo = Math.round(saldo);
    uke.minSaldo = Math.round(uke.minSaldo);
    uker.push(uke);
  }

  let kumulertUkeInn = 0;
  for (const uke of uker) {
    kumulertUkeInn += uke.inn;
    const bredde = kumulertUkeInn * usikkerhet;
    uke.lav = Math.round(uke.minSaldo - bredde);
    uke.hoy = Math.round(uke.sluttSaldo + bredde);
  }

  return {
    startSaldo,
    ramme,
    uker,
    dager,
    tomKasseDato,
    ukerTilTomKasse: tomKasseDato ? Math.floor(dagerMellom(start, tomKasseDato) / 7) : null,
    lavesteSaldo: Math.round(lavesteSaldo),
    lavesteDato,
    brukerReskontro,
    innEndring: innEndring(kunde),
    storsteDebitor: storste.navn,
    storsteDebitorAndel: storste.andelAvInnbetalinger,
    usikkerhet,
  };
}

// Samler ukens poster per navn, største først (for visning)
export function oppsummerPoster(poster: UkePost[]): UkePost[] {
  const map = new Map<string, UkePost>();
  for (const p of poster) {
    const eksisterende = map.get(p.navn);
    if (eksisterende) eksisterende.belop += p.belop;
    else map.set(p.navn, { ...p });
  }
  return [...map.values()].sort((a, b) => Math.abs(b.belop) - Math.abs(a.belop));
}
