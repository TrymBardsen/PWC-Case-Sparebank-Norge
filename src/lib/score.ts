// Prioriteringsscore: vektet sum av forklarbare signaler. Rådgiveren skal alltid
// kunne se nøyaktig hvorfor en kunde ligger høyt på listen.

import type { Kunde } from "./types.ts";
import { DAGENS_DATO, dagerMellom, kortDato } from "./dato.ts";
import { lagPrognose, oppsummerPoster, type Prognose } from "./prognose.ts";
import { BRANSJERISIKO } from "./sesong.ts";
import { kr, mnok, omUker, prosent } from "./format.ts";
import { KATEGORI_TEKST, regelbasertAnalyse, tekstpoeng, type Tekstanalyse } from "./tekst.ts";

export type Kilde = "Prognose" | "Bankdata" | "Regnskapssystem" | "Tredjepart (simulert)" | "Bransje" | "CRM" | "Tekstanalyse";

export interface Faktor {
  id: string;
  navn: string;
  poeng: number;
  maks: number;
  forklaring: string;
  kilde: Kilde;
  ukjent?: boolean; // kan ikke vurderes uten samtykke
}

export type Niva = "Kritisk" | "Høy" | "Følg med" | "Lav";

export interface Vurdering {
  kundeId: string;
  score: number;
  niva: Niva;
  faktorer: Faktor[];
  prognose: Prognose;
  saldoEndringUke: number;
  kkUtnyttelse: number; // nå, 0–1+
  tekstanalyse: Tekstanalyse;
}

export interface Smitte {
  fra: string; // kunde-id til den som sliter
  til: string; // kunde-id til den som er eksponert
  andel: number; // andel av innbetalingene til «til» som kommer fra «fra»
  forsinkelse: number;
}

// Banken ser betalingsstrømmene mellom egne kunder. Når én kunde sliter,
// løftes underleverandørene som er avhengige av den.
export function vurderPortefolje(
  kunder: Kunde[],
  analyseFor: (k: Kunde) => Tekstanalyse = regelbasertAnalyse,
): { vurderinger: Map<string, Vurdering>; smitte: Smitte[] } {
  const vurderinger = new Map(kunder.map((k) => [k.id, vurder(k, analyseFor(k))]));
  const smitte: Smitte[] = [];
  for (const k of kunder) {
    for (const d of k.debitorer) {
      if (!d.internKunde) continue;
      const kilde = vurderinger.get(d.internKunde);
      if (!kilde) continue;
      smitte.push({ fra: d.internKunde, til: k.id, andel: d.andelAvInnbetalinger, forsinkelse: d.snittDagerForsinkelse });
      if (kilde.score < 50) continue;
      const v = vurderinger.get(k.id)!;
      const poeng = Math.min(12, Math.round(d.andelAvInnbetalinger * 25));
      const kildeNavn = kunder.find((x) => x.id === d.internKunde)!.navn;
      v.faktorer.push({
        id: "smitte",
        navn: "Eksponert mot kunde i krise",
        poeng,
        maks: 12,
        forklaring: `${prosent(d.andelAvInnbetalinger)} av innbetalingene kommer fra ${kildeNavn} (score ${kilde.score}). Betaler nå i snitt ${d.snittDagerForsinkelse} dager etter forfall.`,
        kilde: "Bankdata",
      });
      v.score = Math.min(100, v.faktorer.reduce((s, x) => s + x.poeng, 0));
      v.niva = nivaFor(v.score);
    }
  }
  return { vurderinger, smitte };
}

export function nivaFor(score: number): Niva {
  if (score >= 50) return "Kritisk";
  if (score >= 30) return "Høy";
  if (score >= 15) return "Følg med";
  return "Lav";
}

export function vurder(kunde: Kunde, tekstanalyse: Tekstanalyse = regelbasertAnalyse(kunde)): Vurdering {
  const prognose = lagPrognose(kunde);
  const ramme = kunde.kassekredittRamme;
  const saldoer = kunde.dagligSaldo.map((d) => d.saldo);
  const siste30 = saldoer.slice(-30);
  const f: Faktor[] = [];

  // 1. Uker til tom kasse
  {
    const u = prognose.ukerTilTomKasse;
    const p = prognose.sannsynlighetInsolvens;
    // Passerer prognosen grensen, teller tiden. Ellers teller sannsynligheten for at den gjør det.
    const poeng = u !== null ? (u <= 2 ? 30 : u <= 5 ? 24 : u <= 8 ? 15 : 8) : p >= 0.4 ? 12 : p >= 0.2 ? 6 : p >= 0.1 ? 3 : 0;
    let forklaring =
      p >= 0.1
        ? `Prognosen holder seg innenfor rammen, men det er ${prosent(p)} sannsynlighet for å passere insolvensgrensen.`
        : "Prognosen holder seg innenfor rammen de neste 13 ukene.";
    if (prognose.tomKasseDato) {
      const uke = prognose.uker.find((x) => x.poster.some((p) => p.dato === prognose.tomKasseDato)) ?? prognose.uker[0];
      const storsteUt = oppsummerPoster(uke.poster).find((p) => p.belop < 0 && p.kategori !== "variabel");
      forklaring = `Rammen er brukt opp ${kortDato(prognose.tomKasseDato)} (${omUker(u!)})${storsteUt ? `, utløst av ${storsteUt.navn.toLowerCase()} på ${kr(-storsteUt.belop)}` : ""}. Sannsynlighet ${prosent(p)}.`;
    }
    f.push({ id: "tomkasse", navn: "Tid til insolvensgrensen", poeng, maks: 30, forklaring, kilde: "Prognose" });
  }

  // 2. Overtrekk og høy utnyttelse
  {
    const over = siste30.filter((s) => s < -ramme).length;
    const hoy = siste30.filter((s) => s < -0.9 * ramme).length;
    const poeng = over >= 3 ? 15 : over >= 1 ? 10 : hoy >= 15 ? 8 : hoy >= 5 ? 4 : 0;
    const forklaring =
      over > 0
        ? `Kassekreditten var overtrukket ${over} av siste 30 dager, og over 90 % utnyttet ${hoy} dager.`
        : hoy > 0
          ? `Kassekreditten var over 90 % utnyttet ${hoy} av siste 30 dager.`
          : "Ingen overtrekk eller høy utnyttelse siste 30 dager.";
    f.push({ id: "overtrekk", navn: "Overtrekk / høy utnyttelse", poeng, maks: 15, forklaring, kilde: "Bankdata" });
  }

  // 3. Forfalte terminer
  {
    const forfalte = kunde.lan.filter((l) => l.forfalteTerminer > 0);
    const antall = forfalte.reduce((s, l) => s + l.forfalteTerminer, 0);
    const belop = forfalte.reduce((s, l) => s + l.forfaltBelop, 0);
    f.push({
      id: "terminer",
      navn: "Forfalte terminer på lån",
      poeng: antall === 0 ? 0 : antall >= 2 ? 15 : 10,
      maks: 15,
      forklaring: antall === 0 ? "Ingen forfalte terminer." : `${antall} forfalt${antall > 1 ? "e" : ""} termin${antall > 1 ? "er" : ""} (${kr(belop)}).`,
      kilde: "Bankdata",
    });
  }

  // 4. Skatt og MVA
  if (kunde.restanser) {
    const sum = kunde.restanser.mva + kunde.restanser.forskuddstrekkOgAga;
    f.push({
      id: "restanser",
      navn: "Skatte- og MVA-restanser",
      poeng: sum > 0 ? 12 : 0,
      maks: 12,
      forklaring: sum > 0 ? `Skylder det offentlige ${kr(sum)}${kunde.restanser.forskuddstrekkOgAga > 0 ? " (inkl. forskuddstrekk – alvorlig)" : ""}.` : "Ingen restanser.",
      kilde: "Regnskapssystem",
    });
  } else {
    f.push({ id: "restanser", navn: "Skatte- og MVA-restanser", poeng: 0, maks: 12, forklaring: "Ukjent – krever samtykke til regnskapsdata.", kilde: "Regnskapssystem", ukjent: true });
  }

  // 5. Fakturaer som drar ut
  if (kunde.fakturaer) {
    const total = kunde.fakturaer.reduce((s, x) => s + x.belop, 0);
    const gamle = kunde.fakturaer.filter((x) => dagerMellom(x.forfall, DAGENS_DATO) > 30);
    const gammelSum = gamle.reduce((s, x) => s + x.belop, 0);
    const andel = total > 0 ? gammelSum / total : 0;
    f.push({
      id: "fakturaer",
      navn: "Fakturaer over 30 dager forfalt",
      poeng: andel >= 0.3 ? 8 : andel >= 0.1 ? 4 : 0,
      maks: 8,
      forklaring: gamle.length
        ? `${kr(gammelSum)} (${prosent(andel)} av utestående) er mer enn 30 dager over forfall, hovedsakelig ${gamle[0].debitor}.`
        : "Ingen fakturaer er mer enn 30 dager over forfall.",
      kilde: "Regnskapssystem",
    });
  } else {
    f.push({ id: "fakturaer", navn: "Fakturaer over 30 dager forfalt", poeng: 0, maks: 8, forklaring: "Ukjent – krever samtykke til reskontro.", kilde: "Regnskapssystem", ukjent: true });
  }

  // 6. Leverandørgjeld
  if (kunde.forfaltLeverandorgjeld !== undefined) {
    const forhold = kunde.forfaltLeverandorgjeld / Math.max(1, kunde.historikk.slice(-8).reduce((s, u) => s + u.inn, 0) / 8);
    f.push({
      id: "levgjeld",
      navn: "Forfalt leverandørgjeld",
      poeng: forhold >= 1 ? 5 : forhold >= 0.3 ? 2 : 0,
      maks: 5,
      forklaring: kunde.forfaltLeverandorgjeld > 0 ? `${kr(kunde.forfaltLeverandorgjeld)} forfalt, tilsvarer ${forhold.toFixed(1).replace(".", ",")} uker med innbetalinger.` : "Ingen forfalt leverandørgjeld.",
      kilde: "Regnskapssystem",
    });
  }

  // 7. Avviste betalinger
  {
    const a = kunde.avvisteBetalinger30d;
    f.push({
      id: "avviste",
      navn: "Avviste betalinger",
      poeng: a >= 5 ? 8 : a >= 2 ? 5 : a === 1 ? 2 : 0,
      maks: 8,
      forklaring: a ? `${a} betaling${a > 1 ? "er" : ""} avvist pga. manglende dekning siste 30 dager.` : "Ingen avviste betalinger.",
      kilde: "Bankdata",
    });
  }

  // 8. Fallende innbetalinger
  {
    const e = prognose.innEndring;
    f.push({
      id: "trend",
      navn: "Fallende innbetalinger",
      poeng: e <= -0.2 ? 8 : e <= -0.1 ? 4 : 0,
      maks: 8,
      forklaring: `Innbetalinger siste 6 uker ${e < 0 ? "ned" : "opp"} ${prosent(Math.abs(e))} mot våren (sesongjustert).`,
      kilde: "Bankdata",
    });
  }

  // 9. Forverring siste uke
  const snitt = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const saldoEndringUke = snitt(saldoer.slice(-7)) - snitt(saldoer.slice(-14, -7));
  {
    const relativ = -saldoEndringUke / Math.max(ramme, 100_000);
    f.push({
      id: "forverring",
      navn: "Forverring siste uke",
      poeng: relativ >= 0.25 ? 6 : relativ >= 0.1 ? 3 : 0,
      maks: 6,
      forklaring: `Snittsaldo ${saldoEndringUke < 0 ? "ned" : "opp"} ${kr(Math.abs(saldoEndringUke))} fra uken før.`,
      kilde: "Bankdata",
    });
  }

  // 10. Bankens eksponering
  {
    const brukt = Math.max(0, -saldoer[saldoer.length - 1]);
    const eksponering = kunde.lan.reduce((s, l) => s + l.saldo, 0) + brukt - kunde.sikkerheter;
    f.push({
      id: "eksponering",
      navn: "Usikret eksponering",
      poeng: eksponering >= 1_000_000 ? 6 : eksponering >= 300_000 ? 3 : 0,
      maks: 6,
      forklaring: eksponering > 0 ? `Engasjement minus sikkerheter: ${mnok(eksponering)}.` : "Engasjementet er fullt sikret.",
      kilde: "Bankdata",
    });
  }

  // 11. Tredjepart
  {
    const t = kunde.tredjepart;
    f.push({
      id: "tredjepart",
      navn: "Betalingsanmerkninger / inkasso",
      poeng: t.betalingsanmerkninger > 0 ? 6 : t.inkassosaker > 0 ? 3 : 0,
      maks: 6,
      forklaring:
        t.betalingsanmerkninger + t.inkassosaker > 0
          ? `${t.betalingsanmerkninger} betalingsanmerkning(er), ${t.inkassosaker} åpne inkassosak(er).`
          : "Ingen registrerte anmerkninger.",
      kilde: "Tredjepart (simulert)",
    });
  }

  // 12. Signaler i tekst (notater, e-post, nyheter)
  {
    const { poeng, viktigste } = tekstpoeng(kunde, tekstanalyse);
    f.push({
      id: "tekst",
      navn: "Signaler i tekst",
      poeng,
      maks: 15,
      forklaring: viktigste
        ? `${KATEGORI_TEKST[viktigste.kategori]}${viktigste.gjelderDebitor ? ` (${viktigste.gjelderDebitor})` : ""}: «${viktigste.sitat}»`
        : "Ingen negative signaler i notater, e-post eller nyheter siste 120 dager.",
      kilde: "Tekstanalyse",
    });
  }

  // 13. Bransje
  {
    const r = BRANSJERISIKO[kunde.bransje];
    f.push({ id: "bransje", navn: "Bransjerisiko", poeng: r === "høy" ? 4 : r === "middels" ? 2 : 0, maks: 4, forklaring: `${kunde.bransje}: ${r} konkursrate (SSB).`, kilde: "Bransje" });
  }

  // 14. Glemte kunder
  {
    const d = dagerMellom(kunde.sisteKontakt, DAGENS_DATO);
    f.push({ id: "kontakt", navn: "Dager siden siste kontakt", poeng: d > 120 ? 4 : d > 60 ? 2 : 0, maks: 4, forklaring: `Sist kontaktet for ${d} dager siden.`, kilde: "CRM" });
  }

  const score = Math.min(100, f.reduce((s, x) => s + x.poeng, 0));
  return {
    kundeId: kunde.id,
    score,
    niva: nivaFor(score),
    faktorer: f,
    prognose,
    saldoEndringUke,
    kkUtnyttelse: ramme > 0 ? Math.max(0, -saldoer[saldoer.length - 1]) / ramme : 0,
    tekstanalyse,
  };
}
