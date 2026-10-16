import { test } from "node:test";
import assert from "node:assert/strict";
import { kopi, kunde, portefolje } from "./hjelp.ts";
import { lagPrognose, STANDARDVALG, ukeFor } from "../src/lib/prognose.ts";
import { kjentePoster } from "../src/lib/kalender.ts";
import { DAGENS_DATO, leggTilDager } from "../src/lib/dato.ts";

const poster = (p: ReturnType<typeof lagPrognose>) => p.uker.flatMap((u) => u.poster);

test("prognosen starter dagen etter dagens saldo og dekker 13 hele uker", () => {
  const p = lagPrognose(kunde("B-114"));
  assert.equal(p.dager[0].dato, leggTilDager(DAGENS_DATO, 1));
  assert.equal(p.dager.length, 91);
  assert.equal(p.uker.length, 13);
  p.uker.forEach((u, i) => assert.equal(u.fra, leggTilDager(DAGENS_DATO, 1 + i * 7)));
});

test("dagens bevegelser telles ikke to ganger (ingen poster på DAGENS_DATO)", () => {
  for (const k of portefolje.kunder) {
    assert.ok(!poster(lagPrognose(k)).some((x) => x.dato === DAGENS_DATO), k.id);
  }
});

test("sluttsaldo = startsaldo + summen av alle poster", () => {
  for (const id of ["B-114", "B-002", "B-005", "B-054"]) {
    const p = lagPrognose(kunde(id));
    const sum = poster(p).reduce((s, x) => s + x.belop, 0);
    assert.ok(Math.abs(p.startSaldo + sum - p.uker.at(-1)!.sluttSaldo) <= 1, id);
  }
});

test("margin og grense henger sammen, og sannsynlighet er mellom 0 og 1", () => {
  for (const k of portefolje.kunder) {
    const p = lagPrognose(k);
    assert.equal(p.margin, p.lavesteSaldo + p.ramme, k.id);
    assert.ok(p.sannsynlighetInsolvens >= 0 && p.sannsynlighetInsolvens <= 1, k.id);
    if (p.tomKasseDato) assert.ok(p.dager.find((d) => d.dato === p.tomKasseDato)!.saldo < -p.ramme, k.id);
    else assert.ok(p.margin >= -1, k.id);
  }
});

test("lån som har passert sluttdato betjenes videre (som i historikken)", () => {
  // B-054: sluttdato 2025-12-31, men saldo 5,18 MNOK og neste forfall 20. oktober
  const lan = poster(lagPrognose(kunde("B-054"))).filter((x) => x.kategori === "lan");
  assert.deepEqual(
    lan.map((x) => x.dato),
    ["2026-10-20", "2026-11-20", "2026-12-20"],
  );
});

test("lån som går ut i perioden: terminer fram til sluttdato og sluttbetaling på sluttdatoen", () => {
  const k = kopi("B-114", (x) => (x.lan[0].sluttdato = "2026-11-25"));
  const lan = poster(lagPrognose(k)).filter((x) => x.kategori === "lan");
  assert.deepEqual(
    lan.map((x) => x.dato),
    ["2026-10-20", "2026-11-20", "2026-11-25"],
  );
  assert.equal(lan.at(-1)!.belop, -k.lan[0].sluttbetaling!);
});

test("leasing betales den 1. i måneden", () => {
  const leasing = poster(lagPrognose(kunde("B-002"))).filter((x) => x.navn.startsWith("Leasing") && x.navn.endsWith("termin"));
  assert.deepEqual(
    leasing.map((x) => x.dato),
    ["2026-11-01", "2026-12-01"],
  );
});

test("kunde uten betalere gir prognose uten krasj, også med forsinkelsesscenario", () => {
  const k = kopi("B-114", (x) => (x.debitorer = []));
  const p = lagPrognose(k, { ...STANDARDVALG, storsteKundeForsinkelse: 30 });
  assert.equal(p.storsteDebitor, null);
  assert.equal(p.storsteDebitorAndel, 0);
  assert.equal(p.dager.length, 91);
});

test("kassekreditt til lån kan ikke overstige det som er trukket", () => {
  const k = kunde("B-114");
  const trekk = k.kassekredittTrekk.at(-1)!;
  const akkurat = lagPrognose(k, { ...STANDARDVALG, kkTilLan: trekk });
  const forMye = lagPrognose(k, { ...STANDARDVALG, kkTilLan: trekk * 3 });
  assert.equal(forMye.margin, akkurat.margin);
  const tilfort = poster(forMye).find((x) => x.navn === "Kassekreditt omgjort til nedbetalingslån")!;
  assert.equal(tilfort.belop, trekk);
});

test("scenarioer trekker i forventet retning", () => {
  const k = kunde("B-031");
  const basis = lagPrognose(k);
  assert.ok(lagPrognose(k, { ...STANDARDVALG, omsetningsfall: 0.2 }).margin < basis.margin);
  assert.ok(lagPrognose(k, { ...STANDARDVALG, renteTillegg: 0.02 }).margin <= basis.margin);
  assert.ok(lagPrognose(k, { ...STANDARDVALG, storsteKundeForsinkelse: 30 }).margin <= basis.margin);
  assert.ok(lagPrognose(k, { ...STANDARDVALG, stromFaktor: 2 }).margin <= basis.margin);
});

test("tiltak som tilfører likviditet bedrer marginen", () => {
  const k = kunde("B-114");
  const basis = lagPrognose(k);
  assert.ok(lagPrognose(k, { ...STANDARDVALG, avdragsfrihet: true }).margin > basis.margin);
  assert.ok(lagPrognose(k, { ...STANDARDVALG, kapitaltilskudd: 500_000 }).margin > basis.margin);
  // Økt ramme flytter grensen, ikke saldoen
  const ramme = lagPrognose(k, { ...STANDARDVALG, rammeokning: 500_000 });
  assert.equal(ramme.ramme, basis.ramme + 500_000);
  assert.equal(ramme.lavesteSaldo, basis.lavesteSaldo);
});

test("avdragsfrihet fjerner avdraget, men ikke rentene", () => {
  const k = kunde("B-114");
  const termin = poster(lagPrognose(k, { ...STANDARDVALG, avdragsfrihet: true })).find((x) => x.navn.endsWith("kun renter"))!;
  assert.equal(-termin.belop, Math.round((k.lan[0].saldo * k.lan[0].rentesats) / 12));
});

test("MVA-avtale deler forfallet i like deler med påslag", () => {
  const k = kunde("B-031");
  const uten = poster(lagPrognose(k)).filter((x) => x.kategori === "mva" && x.navn.includes("4. termin"));
  const med = poster(lagPrognose(k, { ...STANDARDVALG, mvaAvtale: true, mvaAvtaleMnd: 3 })).filter((x) => x.navn.includes("4. termin"));
  assert.equal(uten.length, 1);
  assert.equal(med.length, 3);
  const sum = med.reduce((s, x) => s + x.belop, 0);
  assert.ok(Math.abs(sum - uten[0].belop * 1.015) < 2);
});

test("MVA for måned uten historikk bruker anslaget for måneden, ellers faktisk omsetning", () => {
  const k = kunde("B-031");
  const mva = (est: number, fn?: (a: number, m: number) => number) =>
    kjentePoster(k, "2026-12-01", "2026-12-31", { estimertInnPerMnd: est, estimertInnForMaaned: fn, innForMaaned: (a, m) => (a === 2026 && m === 8 ? 1_000_000 : undefined) }).find(
      (x) => x.kategori === "mva",
    )!;
  // 5. termin (sep–okt): september er kjent, oktober anslås
  const medAnslag = mva(0, (a, m) => (a === 2026 && m === 9 ? 2_000_000 : 0));
  assert.equal(medAnslag.belop, Math.round(3_000_000 * k.faste.mvaAndelAvOmsetning));
  const utenAnslag = mva(500_000);
  assert.equal(utenAnslag.belop, Math.round(1_500_000 * k.faste.mvaAndelAvOmsetning));
});

test("ukeFor finner uken som inneholder en dato", () => {
  const p = lagPrognose(kunde("B-114"));
  assert.equal(ukeFor(p, p.uker[2].fra)?.nr, 3);
  assert.equal(ukeFor(p, leggTilDager(p.uker[2].fra, 6))?.nr, 3);
  assert.equal(ukeFor(p, DAGENS_DATO), undefined);
});
