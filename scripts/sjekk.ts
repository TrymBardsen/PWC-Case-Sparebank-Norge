// Skriver ut score og prognose for alle kunder, for å kalibrere demodataene.
// Kjør: node scripts/sjekk.ts

import { portefolje as data } from "./last-portefolje.ts";
import { vurder, vurderPortefolje } from "../src/lib/score.ts";

const { vurderinger } = vurderPortefolje(data.kunder);
const rader = data.kunder.map((k) => ({ k, v: vurderinger.get(k.id)! })).sort((a, b) => b.v.score - a.v.score);
for (const { k, v } of rader) {
  const p = v.prognose;
  console.log(
    `${String(v.score).padStart(3)} ${v.niva.padEnd(8)} ${k.navn.padEnd(28)} tom: ${p.tomKasseDato ?? "-"}  lavest: ${Math.round(p.lavesteSaldo / 1000)}k / ramme ${k.kassekredittRamme / 1000}k  inn: ${Math.round(p.innEndring * 100)}%  p=${Math.round(p.sannsynlighetInsolvens * 100)}% trend=${(p.metode.trendPerUke * 100).toFixed(1)}%/u σ=${Math.round(p.metode.sigmaPerUke / 1000)}k ${p.metode.sesong}`,
  );
  console.log("     " + v.faktorer.filter((f) => f.poeng > 0).map((f) => `${f.id}:${f.poeng}`).join(" "));
}

const id = process.argv[2];
if (id) {
  const k = data.kunder.find((x) => x.id === id || x.navn.startsWith(id))!;
  const p = vurder(k).prognose;
  for (const u of p.uker) {
    console.log(`uke ${u.nr} ${u.fra} inn ${Math.round(u.inn / 1000)}k ut ${Math.round(u.ut / 1000)}k slutt ${Math.round(u.sluttSaldo / 1000)}k min ${Math.round(u.minSaldo / 1000)}k p ${Math.round(u.sannsynlighet * 100)}%`);
  }
}
