import { test } from "node:test";
import assert from "node:assert/strict";
import { kopi, kunde, portefolje } from "./hjelp.ts";
import { MAKS_SANNSYNLIGHET, tiltakFor, vurderTiltak } from "../src/lib/tiltak.ts";
import { nivaFor, vurder, vurderPortefolje } from "../src/lib/score.ts";
import { usikkerheterFor } from "../src/lib/usikkerhet.ts";
import { lagPrognose, STANDARDVALG } from "../src/lib/prognose.ts";

const oppfylt = (t: ReturnType<typeof vurderTiltak>, p = t.basis) => p.margin >= t.buffer && p.sannsynlighetInsolvens < MAKS_SANNSYNLIGHET;

test("tiltakspakke: samme mål avgjør om en pakke trengs og om den er tilstrekkelig", () => {
  for (const k of portefolje.kunder) {
    const t = vurderTiltak(k);
    if (oppfylt(t)) assert.equal(t.pakke, null, k.id);
    if (t.pakke) {
      assert.equal(t.pakke.tilstrekkelig, oppfylt(t, t.pakke.prognose), k.id);
      assert.ok(t.pakke.tiltak.length <= 4, k.id);
      assert.ok(t.pakke.prognose.margin > t.basis.margin, k.id);
    }
  }
});

test("høy sannsynlighet utløser pakke selv om laveste saldo har margin", () => {
  // F.eks. Bjørkberg Vindu & Dør: over grensen i hovedbanen, men rundt 40 % sannsynlighet for å passere den
  const kandidater = portefolje.kunder
    .map((k) => ({ k, t: vurderTiltak(k) }))
    .filter(({ t }) => t.basis.margin >= t.buffer && t.basis.sannsynlighetInsolvens >= MAKS_SANNSYNLIGHET);
  assert.ok(kandidater.length > 0, "datagrunnlaget har minst én slik kunde");
  for (const { k, t } of kandidater) {
    const nyttig = t.effekter.some((e) => e.forbedring > k.kassekredittRamme * 0.02);
    if (nyttig) assert.ok(t.pakke, k.id);
  }
});

test("tiltak som krever data, er utilgjengelige uten samtykke", () => {
  const uten = portefolje.kunder.find((k) => k.samtykke === 1)!;
  const t = tiltakFor(uten);
  assert.match(t.find((x) => x.id === "innfordring")!.utilgjengelig ?? "", /samtykke/);
  assert.match(t.find((x) => x.id === "factoring")!.utilgjengelig ?? "", /samtykke/);
});

test("kassekreditt-til-lån: største valg er begrenset av faktisk trekk", () => {
  for (const k of portefolje.kunder) {
    const p = tiltakFor(k).find((t) => t.id === "kkTilLan")!.parameter!;
    const trekk = Math.max(0, k.kassekredittTrekk.at(-1)!);
    if (trekk >= 100_000) assert.ok(p.maks <= trekk, k.id);
    assert.ok(p.verdi >= p.min && p.verdi <= p.maks, k.id);
  }
});

test("parametre klemmes innenfor grensene og ignorerer ugyldige tall", () => {
  const k = kunde("B-114");
  const t = tiltakFor(k, { mvaAvtale: 99, kostnadskutt: Number.NaN });
  assert.equal(t.find((x) => x.id === "mvaAvtale")!.parameter!.verdi, 12);
  assert.equal(t.find((x) => x.id === "kostnadskutt")!.parameter!.verdi, 10);
});

test("score er summen av faktorene (maks 100), og nivå følger tersklene", () => {
  const { vurderinger } = vurderPortefolje(portefolje.kunder);
  for (const v of vurderinger.values()) {
    assert.equal(v.score, Math.min(100, v.faktorer.reduce((s, f) => s + f.poeng, 0)), v.kundeId);
    assert.equal(v.niva, nivaFor(v.score));
    for (const f of v.faktorer) {
      assert.ok(f.poeng >= 0 && f.poeng <= f.maks, `${v.kundeId} ${f.id}`);
      assert.doesNotMatch(f.forklaring, /undefined|NaN/, `${v.kundeId} ${f.id}`);
    }
  }
  assert.equal(nivaFor(50), "Kritisk");
  assert.equal(nivaFor(49), "Høy");
  assert.equal(nivaFor(30), "Høy");
  assert.equal(nivaFor(29), "Følg med");
  assert.equal(nivaFor(15), "Følg med");
  assert.equal(nivaFor(14), "Lav");
});

test("tid til insolvensgrensen forklares med dato og utløsende post", () => {
  const v = vurder(kunde("B-114"));
  const f = v.faktorer.find((x) => x.id === "tomkasse")!;
  assert.ok(v.prognose.tomKasseDato);
  assert.equal(f.poeng, 30);
  assert.match(f.forklaring, /Rammen er brukt opp \d+\. \w+ .*utløst av/);
});

test("ukjente restanser sies tydelig for kunder uten regnskapsdata", () => {
  const uten = portefolje.kunder.find((k) => k.samtykke === 1 && !(k.restanser?.skatt ?? 0))!;
  assert.match(vurder(uten).faktorer.find((f) => f.id === "restanser")!.forklaring, /ukjent uten regnskapsdata/);
});

test("det vi ikke vet: utløpte lån, sluttbetalinger, reskontro og metode", () => {
  const tema = (id: string) => {
    const k = kunde(id);
    return usikkerheterFor(k, vurder(k).prognose).map((u) => u.tekst);
  };
  assert.ok(tema("B-054").some((t) => /hadde sluttdato 31\. des 2025/.test(t)));
  assert.ok(tema("B-114").some((t) => /gjøres opp med 1 089 000 kr 31\. des/.test(t.replace(/ /g, " "))));
  assert.ok(tema("B-114").some((t) => /restskatten/.test(t)));
  const uten = portefolje.kunder.find((k) => k.samtykke === 1)!;
  assert.ok(usikkerheterFor(uten, vurder(uten).prognose).some((u) => u.tema === "Reskontro"));
  assert.ok(tema("B-005").some((t) => /ikke testet mot faktiske utfall/.test(t)));
  const ingenBetalere = kopi("B-005", (k) => (k.debitorer = []));
  assert.ok(usikkerheterFor(ingenBetalere, vurder(ingenBetalere).prognose).some((u) => u.tema === "Betalere"));
});

test("Ørnberg Trykk (B-102): avdragsfrihet alene senker sannsynligheten kraftig", () => {
  // Demoeksempel: sunn drift, men et nytt maskinlån med tre års nedbetaling (250 000 kr i avdrag per måned)
  const k = kunde("B-102");
  const basis = lagPrognose(k);
  const avdragsfri = lagPrognose(k, { ...STANDARDVALG, avdragsfrihet: true });
  assert.ok(basis.sannsynlighetInsolvens >= 0.6, `basis ${basis.sannsynlighetInsolvens}`);
  assert.ok(avdragsfri.sannsynlighetInsolvens <= 0.15, `avdragsfri ${avdragsfri.sannsynlighetInsolvens}`);
  assert.ok(avdragsfri.margin - basis.margin >= 500_000);
  assert.ok(vurderTiltak(k).pakke, "risikoen utløser en anbefalt pakke");
  // Datagrunnlaget henger sammen: lånet er i lånesystemet uten kunstig sluttbetaling
  const lan = k.lan.find((l) => l.navn.includes("trykkmaskin"))!;
  assert.equal(lan.avdragPerMnd, 250_000);
  assert.equal(lan.sluttbetaling, 0);
  assert.ok(k.notater.some((n) => n.tekst.includes("utsette avdraga")));
  // Kunden har gitt full tilgang til regnskapsdata: reskontro viser fakturaer og leverandørgjelden notatet nevner
  assert.equal(k.samtykke, 2);
  assert.ok((k.fakturaer?.length ?? 0) > 0);
  assert.equal(k.forfaltLeverandorgjeld, 1_500_000);
  assert.ok(k.notater.some((n) => n.tekst.includes("1,5 mill. i forfalt leverandørgjeld")));
});
