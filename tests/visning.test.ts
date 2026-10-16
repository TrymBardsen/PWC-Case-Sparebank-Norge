import { test } from "node:test";
import assert from "node:assert/strict";
import { kunde } from "./hjelp.ts";
import { antall, belop, kr, krPresis } from "../src/lib/format.ts";
import { visDatoer } from "../src/lib/dato.ts";
import { vurder } from "../src/lib/score.ts";
import { vurderTiltak } from "../src/lib/tiltak.ts";
import { kortForslag, nesteHandling } from "../src/lib/neste.ts";
import { storsteUtbetalinger, usikkerheterFor } from "../src/lib/usikkerhet.ts";

const ren = (s: string) => s.replace(/[  ]/g, " ");

test("beløp fra 100 000 kr rundes til tusen, små beløp og presise beløp gjør det ikke", () => {
  assert.equal(ren(kr(2_226_454)), "2 226 000 kr");
  assert.equal(ren(kr(-248_571)), "\u2212249 000 kr"); // norsk format bruker ekte minustegn
  assert.equal(ren(kr(33_000)), "33 000 kr");
  assert.equal(ren(kr(1_089_000)), "1 089 000 kr");
  assert.equal(ren(krPresis(2_226_454)), "2 226 454 kr");
  assert.equal(belop(2_226_454), "2,2 MNOK");
  assert.equal(ren(belop(512_639)), "513 000 kr");
});

test("antall bøyes riktig", () => {
  assert.equal(antall(1, "kunde er kritisk", "kunder er kritiske"), "1 kunde er kritisk");
  assert.equal(antall(3, "kunde er kritisk", "kunder er kritiske"), "3 kunder er kritiske");
});

test("ISO-datoer i tekst vises på norsk", () => {
  assert.equal(visDatoer("Motparten fekk betalingsanmerkning registrert 2026-08-06."), "Motparten fekk betalingsanmerkning registrert 6. aug 2026.");
  assert.equal(visDatoer("Ingen dato her"), "Ingen dato her");
});

test("neste beste handling: ett forslag med ansvarlig og frist", () => {
  const k = kunde("B-102");
  const v = vurder(k);
  const n = nesteHandling(k, v, vurderTiltak(k));
  assert.ok(n.tiltak, "bygger på første tiltak i pakken");
  assert.equal(n.tiltak!.id, vurderTiltak(k).pakke!.tiltak[0].id);
  assert.ok(n.ansvarlig.length > 1);
  assert.match(n.frist, /^(I dag|Før \d+\. \w+|Innen 2 uker)$/);
  assert.doesNotMatch(kortForslag(n), /\+/, "ingen lang tiltakskjede");
});

test("neste beste handling: sensitiv situasjon gir bare praktisk kontakt", () => {
  const k = kunde("B-009");
  const n = nesteHandling(k, vurder(k), vurderTiltak(k));
  assert.match(n.tittel, /praktisk kontakt/);
  assert.equal(n.tiltak, undefined);
  assert.equal(n.kreditt, false);
});

test("største utbetalinger fremover er kjente poster, sortert på dato", () => {
  const p = vurder(kunde("B-114")).prognose;
  const liste = storsteUtbetalinger(p, 5);
  assert.equal(liste.length, 5);
  assert.deepEqual(
    liste.map((x) => x.dato),
    [...liste].map((x) => x.dato).sort(),
  );
  assert.ok(liste.every((x) => x.belop > 0 && !/Varekjøp/.test(x.navn)));
});

test("det vi ikke vet gir spørsmål til samtalen", () => {
  const k = kunde("B-114");
  const sporsmal = usikkerheterFor(k, vurder(k).prognose).filter((u) => u.sporsmal);
  assert.ok(sporsmal.some((u) => /restskatten/.test(u.sporsmal!)));
  assert.ok(sporsmal.some((u) => /sluttbetalingen/.test(u.sporsmal!)));
});
