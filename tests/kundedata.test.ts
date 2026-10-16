import { test } from "node:test";
import assert from "node:assert/strict";
import { kunde, kundedata, portefolje, tilleggsdata } from "./hjelp.ts";
import { byggPortefolje } from "../src/lib/kundedata.ts";
import { leggTilDager } from "../src/lib/dato.ts";

test("datagrunnlaget gir 120 kunder per 1. oktober 2026", () => {
  assert.equal(portefolje.kunder.length, 120);
  assert.equal(portefolje.dagensDato, "2026-10-01");
});

test("kNOK regnes om til kroner for ramme, saldo og lån", () => {
  const k = kunde("B-114");
  const kk = kundedata.Engasjement.find((e) => e.kunde_id === "B-114" && e.produkt === "Kassakreditt" && e.status === "Aktiv")!;
  assert.equal(k.kassekredittRamme, kk.ramme_knok! * 1000);
  const konto = tilleggsdata.konto_historikk.kundar["B-114"];
  const siste = konto.driftskonto_knok.length - 1;
  assert.equal(k.dagligSaldo.at(-1)!.saldo, (konto.driftskonto_knok[siste] - konto.kassakreditt_trekk_knok![siste]) * 1000);
  assert.equal(k.kassekredittTrekk.at(-1), konto.kassakreditt_trekk_knok![siste] * 1000);
  const lan = tilleggsdata.lan.find((l) => l.kunde_id === "B-114")!;
  assert.equal(k.lan[0].saldo, lan.saldo_knok * 1000);
  assert.equal(k.lan[0].avdragPerMnd, lan.avdrag_per_termin_knok * 1000);
  assert.equal(k.lan[0].forfaltBelop, lan.forfalt_belop_knok * 1000);
});

test("saldo i dag stemmer med Engasjement (driftskonto minus trekk)", () => {
  for (const k of portefolje.kunder) {
    const eng = kundedata.Engasjement.filter((e) => e.kunde_id === k.id && e.status === "Aktiv");
    const drift = eng.find((e) => e.produkt === "Driftskonto")?.saldo_knok ?? 0;
    const trekk = eng.find((e) => e.produkt === "Kassakreditt")?.saldo_knok ?? 0;
    assert.equal(Math.round(k.dagligSaldo.at(-1)!.saldo), Math.round((drift - trekk) * 1000), k.id);
  }
});

test("restskatt fra hendelsen er allerede i kroner og regnes ikke om", () => {
  // «Restskatt 421 000 ubetalt» – og reskontro sier 421 kNOK
  assert.equal(kunde("B-114").restanser?.skatt, 421_000);
  assert.equal(tilleggsdata.reskontro["B-114"].skatt_mva_restanse_knok * 1000, 421_000);
  assert.equal(kunde("B-007").restanser?.skatt, 410_000);
});

test("forfallsdag leses fra lånesystemet: leasing den 1., serielån den 20.", () => {
  assert.equal(kunde("B-002").lan.find((l) => l.navn.startsWith("Leasing"))?.forfallsdag, 1);
  assert.equal(kunde("B-114").lan[0].forfallsdag, 20);
});

test("reskontro og fakturaer finnes bare for kunder med samtykke", () => {
  for (const k of portefolje.kunder) {
    const samtykke = tilleggsdata.samtykke[k.id]?.rekneskapsdata ?? false;
    assert.equal(k.samtykke, samtykke ? 2 : 1, k.id);
    if (!samtykke) {
      assert.equal(k.fakturaer, undefined, k.id);
      assert.equal(k.forfaltLeverandorgjeld, undefined, k.id);
    }
  }
  const medFaktura = portefolje.kunder.find((k) => (k.fakturaer?.length ?? 0) > 0)!;
  const rad = tilleggsdata.reskontro[medFaktura.id].kundefordringar[0];
  assert.equal(medFaktura.fakturaer![0].belop, rad.belop_knok * 1000);
});

test("historikken har 104 uker og 365 dager, uten hull", () => {
  for (const k of portefolje.kunder) {
    assert.equal(k.historikk.length, 104, k.id);
    assert.equal(k.dagligSaldo.length, 365, k.id);
    assert.equal(k.dagligSaldo.at(-1)!.dato, "2026-10-01");
    assert.ok(k.historikk.every((u) => Number.isFinite(u.inn) && Number.isFinite(u.utVariabel) && Number.isFinite(u.utFaste)), k.id);
  }
});

test("motpart og sensitiv situasjon tolkes fra hendelsene", () => {
  assert.equal(kunde("B-005").motpart?.andel, 0.62);
  assert.equal(kunde("B-005").motpart?.dato, "2026-07-22");
  assert.ok(kunde("B-009").sensitiv);
});

test("datagrunnlaget forskyves til valgt dato uten å endre beløp eller kalenderprofiler", () => {
  const flyttet = byggPortefolje(kundedata, tilleggsdata, "2026-10-16");
  assert.equal(flyttet.dagensDato, "2026-10-16");
  const [for_, etter] = [kunde("B-114"), flyttet.kunder.find((k) => k.id === "B-114")!];
  assert.equal(etter.dagligSaldo.at(-1)!.dato, "2026-10-16");
  assert.equal(etter.dagligSaldo.at(-1)!.saldo, for_.dagligSaldo.at(-1)!.saldo);
  assert.equal(etter.historikk[0].fra, "2024-10-15"); // 2024-09-30 + 15 dager
  assert.deepEqual(etter.faste, for_.faste);
  assert.equal(etter.lan[0].sluttdato, "2027-01-15");
  assert.equal(etter.lan[0].forfallsdag, 20);
  assert.equal(etter.restanser?.skatt, 421_000);
  // ISO-datoer i hendelsestekster flyttes også, så sitater og datoer henger sammen
  assert.ok(etter.tekster.some((t) => t.tekst.includes("forfall 2026-05-09")));
  assert.ok(!etter.tekster.some((t) => t.tekst.includes("forfall 2026-04-24")));
  assert.equal(etter.sisteKontakt, leggTilDager(for_.sisteKontakt!, 15));
});

test("kundene er fordelt på tre rådgivere, med Hanne som standard og alle demokundene", () => {
  assert.equal(portefolje.radgiver, "Hanne");
  assert.deepEqual(portefolje.radgivere, ["Hanne", "Ingrid", "Jonas"]);
  const antall = (r: string) => portefolje.kunder.filter((k) => k.radgiver === r).length;
  assert.deepEqual([antall("Hanne"), antall("Ingrid"), antall("Jonas")], [48, 36, 36]);
  for (const id of ["B-114", "B-102", "B-075", "B-005", "B-009", "B-002"]) assert.equal(kunde(id).radgiver, "Hanne", id);
  // Møtenotater står på rådgiveren som skrev dem
  for (const k of portefolje.kunder) for (const n of k.notater) assert.ok(n.forfatter === "CRM" || n.forfatter === k.radgiver, `${k.id} ${n.forfatter}`);
});
