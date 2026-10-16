// Oversetter data/kundedata.json og data/tilleggsdata.json til appens kundemodell.
// Kildene er i kNOK og nynorsk; appen regner i kroner. Ingenting anslås her som ikke
// kan utledes fra dataene: faste kostnader leses fra gjentakende betalinger i transaksjonene.
//
// Datagrunnlaget gjelder per 1. oktober 2026. For at demoen skal gjelde «i dag», forskyves alle
// datoer i kundemodellen (også ISO-datoer i hendelsestekster) like mange dager fram. Faste kostnader
// per kalendermåned leses først, fra de opprinnelige datoene, så lønn den 20. og MVA-terminer
// fortsatt havner på riktige kalenderdager i prognosen.

import type { Bransjerisiko, Kunde, Lan, Motpart, Notat, Portefolje, Tekstkilde, Uke } from "./types.ts";
import { DAGENS_DATO, dagerMellom, leggTilDager } from "./dato.ts";

const KNOK = 1000;

export const STANDARD_RADGIVER = "Hanne";

// ---- råformat ----
interface Bedrift {
  kunde_id: string;
  org_nr: string;
  namn: string;
  bransje: string;
  nace: string;
  kommune: string;
  etablert_aar: number;
  kunde_sidan: number;
  segment: string;
  eigarstruktur: string;
  dagleg_leiar: string;
  tilsette_2026: number;
  omsetning_2023_knok: number;
  omsetning_2024_knok: number;
  omsetning_2025_knok: number;
  driftsresultat_2025_knok: number;
  eigenkapital_pst: number;
  risikoklasse: string;
  sist_kontakt: string | null;
  sist_kontakt_type: string | null;
  raadgivar: string;
}
interface Engasjement {
  kunde_id: string;
  produkt: string;
  ramme_knok: number | null;
  saldo_knok: number | null;
  rente_pst: number | null;
  status: string;
}
interface Hending {
  hending_id: string;
  kunde_id: string;
  dato: string;
  kjelde: string;
  kategori: string;
  hending: string;
  sitat: string | null;
}
export interface Kundedata {
  les_meg: string[];
  Bedrifter: Bedrift[];
  Engasjement: Engasjement[];
  Hendingar: Hending[];
}
interface SsbNaering {
  namn: string;
  Vestland: { konkursar_siste_4_kvartal: number; konkursar_forrige_4_kvartal: number; endring_pst: number | null; konkursar_per_1000_bedrifter: number | null };
  "Hele landet": { konkursar_per_1000_bedrifter: number | null };
}
export interface Tilleggsdata {
  konto_historikk: { fra: string; til: string; kundar: Record<string, { driftskonto_knok: number[]; kassakreditt_trekk_knok: number[] | null; kassakreditt_ramme_knok: number | null }> };
  kontantstraum: { kundar: Record<string, { veke_fra: string[]; inn: Record<string, number[]>; ut: Record<string, number[]> }> };
  betalarar: Record<string, { namn: string; type: string; andel_2026_pst: number }[]>;
  lan: { kunde_id: string; produkt: string; objekt: string | null; saldo_knok: number; rente_pst: number; avdrag_per_termin_knok: number; neste_forfall: string; sluttdato: string; sluttbetaling_knok: number; forfalne_terminar: number; forfalt_belop_knok: number }[];
  sikkerheiter: { kunde_id: string; verdi_knok: number }[];
  avviste_betalingar: { kunde_id: string; dato: string; belop_knok: number }[];
  samtykke: Record<string, { rekneskapsdata: boolean; system: string | null }>;
  reskontro: Record<
    string,
    { kundefordringar: { debitor: string; belop_knok: number; fakturadato: string; forfall: string; snitt_dagar_etter_forfall: number }[]; leverandorgjeld_forfalt_knok: number; skatt_mva_restanse_knok: number }
  >;
  ssb_konkurs: { kvartal_siste_4: string[]; naeringar_2siffer: Record<string, SsbNaering> } | null;
}

// ---- hjelpere ----
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const plussDagar = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dagarMellom = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

function hendingstype(kjelde: string): Tekstkilde["type"] {
  if (kjelde.startsWith("Bank")) return "bank";
  return "kunngjoring";
}

function bransjerisikoFor(nace: string, ssb: Tilleggsdata["ssb_konkurs"]): Bransjerisiko {
  const n = ssb?.naeringar_2siffer[nace.slice(0, 2)];
  const v = n?.Vestland;
  if (!n || !v || v.konkursar_per_1000_bedrifter === null) return { niva: "ukjent", forklaring: "Ingen konkursstatistikk for næringen." };
  const rate = v.konkursar_per_1000_bedrifter;
  const niva = rate >= 10 ? "høy" : rate >= 5 ? "middels" : "lav";
  const endring = v.endring_pst === null ? "" : `, ${v.endring_pst >= 0 ? "+" : ""}${v.endring_pst} % mot året før`;
  return {
    niva,
    forklaring: `${n.namn}: ${v.konkursar_siste_4_kvartal} konkurser i Vestland siste fire kvartaler (${String(rate).replace(".", ",")} per 1000 bedrifter${endring}). Kilde: SSB.`,
  };
}

// Sesongprofil fra egen historikk (uker eldre enn 13 uker, så et fall nå ikke tolkes som sesong)
function sesongFra(uker: Uke[]): number[] {
  const perMnd: number[][] = Array.from({ length: 12 }, () => []);
  for (const u of uker.slice(0, -13)) perMnd[new Date(plussDagar(u.fra, 3) + "T00:00:00Z").getUTCMonth()].push(u.inn);
  const snitt = perMnd.map((xs) => (xs.length ? sum(xs) / xs.length : NaN));
  const gyldige = snitt.filter((x) => Number.isFinite(x) && x > 0);
  const totalt = gyldige.length ? sum(gyldige) / gyldige.length : 1;
  return snitt.map((x) => (Number.isFinite(x) && x > 0 ? x / totalt : 1));
}

// Flytter alle datoer i en kunde «dager» fram. Beløp, kalendermånedsprofiler og forfallsdag i måneden endres ikke.
export function forskyvKunde(k: Kunde, dager: number): Kunde {
  if (dager === 0) return k;
  const d = (iso: string) => leggTilDager(iso, dager);
  const tekst = (t: string) => t.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (_, iso: string) => d(iso));
  return {
    ...k,
    historikk: k.historikk.map((u) => ({ ...u, fra: d(u.fra) })),
    dagligSaldo: k.dagligSaldo.map((x) => ({ ...x, dato: d(x.dato) })),
    avvisteBetalinger: k.avvisteBetalinger.map((a) => ({ ...a, dato: d(a.dato) })),
    lan: k.lan.map((l) => ({ ...l, sluttdato: l.sluttdato ? d(l.sluttdato) : undefined })),
    fakturaer: k.fakturaer?.map((f) => ({ ...f, fakturadato: d(f.fakturadato), forfall: d(f.forfall) })),
    motpart: k.motpart ? { ...k.motpart, dato: d(k.motpart.dato), hendelse: tekst(k.motpart.hendelse) } : undefined,
    sensitiv: k.sensitiv ? tekst(k.sensitiv) : undefined,
    sisteKontakt: k.sisteKontakt ? d(k.sisteKontakt) : null,
    notater: k.notater.map((n) => ({ ...n, dato: d(n.dato), tekst: tekst(n.tekst) })),
    tekster: k.tekster.map((t) => ({ ...t, dato: d(t.dato), tekst: tekst(t.tekst) })),
  };
}

// dagensDato: datoen datagrunnlaget skal gjelde for (standard: i dag, se DAGENS_DATO)
export function byggPortefolje(kd: Kundedata, td: Tilleggsdata, dagensDato: string = DAGENS_DATO): Portefolje {
  const perDato = kd.les_meg.join(" ").match(/Per dato: (\d{4}-\d{2}-\d{2})/)?.[1] ?? td.konto_historikk.til;
  // Rådgiver per kunde («Hanne (BM Bergen)» → «Hanne»). Hanne er standard når hun finnes.
  const radgiverFor = (b: Bedrift) => b.raadgivar.replace(/\s*\(.*\)/, "");
  const radgivere = [...new Set(kd.Bedrifter.map(radgiverFor))].sort((a, b) => Number(b === STANDARD_RADGIVER) - Number(a === STANDARD_RADGIVER) || a.localeCompare(b, "nb"));
  const standard = radgivere[0] ?? "Rådgiver";

  const kunder: Kunde[] = kd.Bedrifter.map((b) => {
    const id = b.kunde_id;
    const radgiver = radgiverFor(b);
    const eng = kd.Engasjement.filter((e) => e.kunde_id === id && e.status === "Aktiv");
    const kk = eng.find((e) => e.produkt === "Kassakreditt");
    const hendingar = kd.Hendingar.filter((h) => h.kunde_id === id);

    // Ukentlig kontantstrøm
    const ks = td.kontantstraum.kundar[id];
    const historikk: Uke[] = ks.veke_fra.map((fra, i) => ({
      fra,
      // Kontantinnskudd og overføringer er uregelmessige og holdes utenfor nivået
      inn: (ks.inn.kundar[i] + ks.inn.kort[i]) * KNOK,
      utVariabel: (ks.ut.leverandorar[i] + ks.ut.otp[i] + ks.ut.anna_ut[i] + ks.ut.selskapsskatt[i]) * KNOK,
      utFaste: (ks.ut.lonn[i] + ks.ut.skattetrekk_aga[i] + ks.ut.mva[i] + ks.ut.husleige[i] + ks.ut.straum[i] + ks.ut.lan_leasing[i]) * KNOK,
    }));

    // Daglig likviditet = driftskonto − trekk på kassekreditt
    const konto = td.konto_historikk.kundar[id];
    const dagligSaldo = konto.driftskonto_knok.map((d, i) => ({ dato: plussDagar(td.konto_historikk.fra, i), saldo: (d - (konto.kassakreditt_trekk_knok?.[i] ?? 0)) * KNOK }));

    // Faste kostnader lest fra gjentakende betalinger
    const sisteAar = ks.veke_fra.map((f, i) => (f >= plussDagar(perDato, -365) ? i : -1)).filter((i) => i >= 0);
    // Siste tre månader: tre ordinære lønninger (den 20.), uten juni (feriepenger) og desember (halv skatt)
    const kvartal3 = ks.veke_fra.map((f, i) => (f >= plussDagar(perDato, -94) && f < plussDagar(perDato, -3) ? i : -1)).filter((i) => i >= 0);
    const sumAv = (kat: Record<string, number[]>, k: string, idx: number[]) => sum(idx.map((i) => kat[k][i])) * KNOK;
    const nettoLonnPerMnd = sumAv(ks.ut, "lonn", kvartal3) / 3;
    const innSisteAar = sum(sisteAar.map((i) => ks.inn.kundar[i] + ks.inn.kort[i])) * KNOK;
    // Betaling i veka som inneheld ein bestemt dato (lønn den 20., skatt og straum den 15.)
    const iVeka = (kat: string, dato: string) => {
      const i = ks.veke_fra.findIndex((f) => f <= dato && dato <= plussDagar(f, 6));
      return i >= 0 ? ks.ut[kat][i] * KNOK : 0;
    };
    const fjoraaret = (m: number, dag: number) => {
      // Siste passerte forekomst av måned m, dag «dag» før perDato
      const aar = Number(perDato.slice(0, 4));
      const kandidat = `${aar}-${String(m + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
      return kandidat < perDato ? kandidat : `${aar - 1}-${String(m + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
    };
    // Vekst i lønnskostnad: siste tre måneder mot samme måneder året før
    const lonnNaa = [7, 8, 9].reduce((s, m) => s + iVeka("lonn", `${Number(perDato.slice(0, 4))}-${String(m).padStart(2, "0")}-20`), 0);
    const lonnFjor = [7, 8, 9].reduce((s, m) => s + iVeka("lonn", `${Number(perDato.slice(0, 4)) - 1}-${String(m).padStart(2, "0")}-20`), 0);
    const lonnVekst = lonnFjor > 0 ? lonnNaa / lonnFjor : 1;
    const perMnd = {
      lonn: Array.from({ length: 12 }, (_, m) => iVeka("lonn", fjoraaret(m, 20)) * (fjoraaret(m, 20) < plussDagar(perDato, -90) ? lonnVekst : 1)),
      skattetrekkOgAga: Array.from({ length: 12 }, (_, m) => (m % 2 === 0 ? iVeka("skattetrekk_aga", fjoraaret(m, 15)) * (fjoraaret(m, 15) < plussDagar(perDato, -90) ? lonnVekst : 1) : 0)),
      strom: Array.from({ length: 12 }, (_, m) => iVeka("straum", fjoraaret(m, 15))),
    };
    const faste = {
      perMnd,
      bruttoLonnPerMnd: nettoLonnPerMnd / 0.7,
      husleiePerMnd: sumAv(ks.ut, "husleige", sisteAar) / 12,
      stromPerMnd: sumAv(ks.ut, "straum", sisteAar) / 12,
      mvaAndelAvOmsetning: innSisteAar > 0 ? sumAv(ks.ut, "mva", sisteAar) / innSisteAar : 0,
    };

    const lan: Lan[] = td.lan
      .filter((l) => l.kunde_id === id)
      .map((l) => ({
        navn: `${l.produkt}${l.objekt ? `: ${l.objekt.toLowerCase()}` : ""}`,
        saldo: l.saldo_knok * KNOK,
        rentesats: l.rente_pst / 100,
        avdragPerMnd: l.avdrag_per_termin_knok * KNOK,
        forfalteTerminer: l.forfalne_terminar,
        forfaltBelop: l.forfalt_belop_knok * KNOK,
        sluttdato: l.sluttdato,
        sluttbetaling: l.sluttbetaling_knok * KNOK,
        // Serielån betales den 20., leasing den 1. (neste_forfall i lånesystemet)
        forfallsdag: Number(l.neste_forfall.slice(8, 10)) || 20,
      }));

    // Samtykke og reskontro
    const samtykke = td.samtykke[id];
    const reskontro = samtykke?.rekneskapsdata ? td.reskontro[id] : undefined;
    const forsinkelse = new Map(reskontro?.kundefordringar.map((f) => [f.debitor, f.snitt_dagar_etter_forfall]) ?? []);
    const debitorer = (td.betalarar[id] ?? []).map((p) => ({
      navn: p.namn,
      type: p.type,
      andelAvInnbetalinger: p.andel_2026_pst / 100,
      snittDagerForsinkelse: p.type === "Kortoppgjer" || p.type === "Privat" ? 0 : forsinkelse.get(p.namn),
    }));

    // Hendelser: restskatt, inkasso, motpart og sensitive situasjoner
    const anmerkningar = hendingar.filter((h) => h.kategori === "Betalingsanmerkning");
    const restskatt = anmerkningar.reduce((s, h) => s + Number(h.hending.match(/Restskatt ([\d ]+) ubetalt/)?.[1].replace(/\s/g, "") ?? 0), 0);
    const inkasso = anmerkningar.reduce((s, h) => s + (/To inkassosaker/.test(h.hending) ? 2 : /inkassosak/i.test(h.hending) ? 1 : 0), 0);
    const motpartH = hendingar.find((h) => h.kategori === "Motpart");
    const mp = motpartH?.hending.match(/(\d+) % av innbetalingane i 2026 kjem frå (.+?)\. Motparten fekk betalingsanmerkning registrert (\d{4}-\d{2}-\d{2})/);
    const motpart: Motpart | undefined = mp ? { navn: mp[2], andel: Number(mp[1]) / 100, hendelse: motpartH!.hending, dato: mp[3] } : undefined;
    const sensitivH = hendingar.find((h) => /dødsfall|ikkje kontaktar|ikke kontakter/i.test(h.hending));

    const notater: Notat[] = hendingar
      .filter((h) => h.kjelde.startsWith("Møtenotat") || h.kjelde === "Bank (CRM)")
      .map((h) => ({ dato: h.dato, forfatter: h.kjelde.startsWith("Møtenotat") ? (h.kjelde.match(/Møtenotat \((.+)\)/)?.[1] ?? radgiver) : "CRM", tekst: h.sitat ? `${h.hending} Kunden sa: «${h.sitat}»` : h.hending }));
    const tekster: Tekstkilde[] = hendingar
      .filter((h) => !h.kjelde.startsWith("Møtenotat") && h.kjelde !== "Bank (CRM)")
      .map((h) => ({ id: h.hending_id, type: hendingstype(h.kjelde), dato: h.dato, avsender: h.kjelde, tittel: h.kategori, tekst: h.sitat ? `${h.hending} «${h.sitat}»` : h.hending }));

    const avvisteListe = td.avviste_betalingar.filter((a) => a.kunde_id === id).map((a) => ({ dato: a.dato, belop: a.belop_knok * KNOK }));
    const avviste = avvisteListe.filter((a) => dagarMellom(a.dato, perDato) <= 90).length;
    const sesongprofil = sesongFra(historikk);
    const strom = faste.stromPerMnd * 12;

    return {
      id,
      navn: b.namn,
      orgnr: b.org_nr,
      bransje: b.bransje,
      naceKode: `${b.nace} ${b.bransje}`,
      adresse: b.kommune,
      ansatte: b.tilsette_2026,
      etablert: b.etablert_aar,
      kundeSiden: b.kunde_sidan,
      segment: b.segment,
      eierstruktur: b.eigarstruktur,
      dagligLeder: b.dagleg_leiar,
      radgiver,
      samtykke: samtykke?.rekneskapsdata ? 2 : 1,
      regnskapssystem: samtykke?.system ?? undefined,
      risikoklasse: b.risikoklasse,
      energiintensiv: innSisteAar > 0 && strom / innSisteAar > 0.02,
      sesongbedrift: Math.max(...sesongprofil) / Math.min(...sesongprofil) > 1.8,
      sesongprofil,
      bransjerisiko: bransjerisikoFor(b.nace, td.ssb_konkurs),
      kassekredittRamme: (kk?.ramme_knok ?? 0) * KNOK,
      kassekredittRente: (kk?.rente_pst ?? 8) / 100,
      kassekredittTrekk: (konto.kassakreditt_trekk_knok ?? konto.driftskonto_knok.map(() => 0)).map((x) => x * KNOK),
      lan,
      sikkerheter: sum(td.sikkerheiter.filter((s) => s.kunde_id === id).map((s) => s.verdi_knok)) * KNOK,
      faste,
      historikk,
      dagligSaldo,
      avvisteBetalinger90d: avviste,
      avvisteBetalinger: avvisteListe,
      debitorer,
      fakturaer: reskontro?.kundefordringar.map((f, i) => ({ id: `${id}-f${i + 1}`, debitor: f.debitor, belop: f.belop_knok * KNOK, fakturadato: f.fakturadato, forfall: f.forfall })),
      forfaltLeverandorgjeld: reskontro ? reskontro.leverandorgjeld_forfalt_knok * KNOK : undefined,
      restanser: { mva: 0, forskuddstrekkOgAga: 0, skatt: restskatt },
      tredjepart: { betalingsanmerkninger: anmerkningar.length, inkassosaker: inkasso },
      motpart,
      sensitiv: sensitivH ? `${sensitivH.hending}${sensitivH.sitat ? ` Kunden sa: «${sensitivH.sitat}»` : ""}` : undefined,
      sisteKontakt: b.sist_kontakt,
      sisteKontaktType: b.sist_kontakt_type,
      notater,
      regnskapIFjor: {
        driftsinntekter: b.omsetning_2025_knok * KNOK,
        driftsresultat: b.driftsresultat_2025_knok * KNOK,
        egenkapitalAndel: b.eigenkapital_pst / 100,
        omsetning: [
          { aar: 2023, belop: b.omsetning_2023_knok * KNOK },
          { aar: 2024, belop: b.omsetning_2024_knok * KNOK },
          { aar: 2025, belop: b.omsetning_2025_knok * KNOK },
        ],
      },
      tekster,
    };
  });

  const forskyvning = dagerMellom(perDato, dagensDato);
  return { dagensDato: leggTilDager(perDato, forskyvning), radgiver: standard, radgivere, kunder: kunder.map((k) => forskyvKunde(k, forskyvning)) };
}
