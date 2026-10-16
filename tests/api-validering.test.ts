import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { KundeForesporsel, lesJson } from "../src/lib/api.ts";
import { privatAdresse } from "../src/lib/nettadresse.ts";
import { tolkRente, tolkStrom } from "../src/lib/makroTolk.ts";
import { EnhetSchema, RegnskapListeSchema, tilDetaljer } from "../src/lib/brregTolk.ts";

const req = (body: string, type = "application/json") => new Request("http://localhost/api/x", { method: "POST", headers: { "Content-Type": type }, body });

test("lesJson: gyldig forespørsel", async () => {
  const r = await lesJson(req(JSON.stringify({ kundeId: "B-114" })), KundeForesporsel);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.kundeId, "B-114");
});

test("lesJson: feil innholdstype gir 415", async () => {
  const r = await lesJson(req("kundeId=B-114", "application/x-www-form-urlencoded"), KundeForesporsel);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.svar.status, 415);
});

test("lesJson: ugyldig JSON gir 400", async () => {
  const r = await lesJson(req("{kundeId:"), KundeForesporsel);
  assert.ok(!r.ok && r.svar.status === 400);
  if (!r.ok) assert.match(((await r.svar.json()) as { feil: string }).feil, /Ugyldig JSON/);
});

test("lesJson: feil form, ekstra felt og farlige ID-er gir 400", async () => {
  for (const body of [{}, { kundeId: 114 }, { kundeId: "../../etc/passwd" }, { kundeId: "B-114", ekstra: true }, [], null]) {
    const r = await lesJson(req(JSON.stringify(body)), KundeForesporsel);
    assert.ok(!r.ok && r.svar.status === 400, JSON.stringify(body));
  }
});

test("lesJson: for stor forespørsel gir 413", async () => {
  const r = await lesJson(req(JSON.stringify({ x: "a".repeat(20_000) })), z.object({ x: z.string() }));
  assert.ok(!r.ok && r.svar.status === 413);
});

test("private og interne adresser avvises før henting av nettkilder", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "ikke-en-ip"]) {
    assert.equal(privatAdresse(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "151.101.1.1", "2606:4700::1111", "::ffff:8.8.8.8"]) assert.equal(privatAdresse(ip), false, ip);
});

test("Norges Bank-svar tolkes, og urimelige eller ødelagte svar gir null", () => {
  const svar = (verdi: string) => ({
    data: { dataSets: [{ series: { "0:0:0:0": { observations: { "0": [verdi] } } } }], structure: { dimensions: { observation: [{ values: [{ id: "2026-10-15" }] }] } } },
  });
  assert.deepEqual(tolkRente(svar("4.25")), { verdi: 4.25, dato: "2026-10-15" });
  assert.equal(tolkRente(svar("425")), null);
  assert.equal(tolkRente(svar("abc")), null);
  assert.equal(tolkRente({ data: {} }), null);
  assert.equal(tolkRente(null), null);
});

test("strømpris tolkes som døgnsnitt, og ugyldige svar gir null", () => {
  assert.deepEqual(tolkStrom([{ NOK_per_kWh: 1 }, { NOK_per_kWh: 2 }], "2026-10-16"), { verdi: 1.5, dato: "2026-10-16" });
  assert.equal(tolkStrom([], "2026-10-16"), null);
  assert.equal(tolkStrom([{ NOK_per_kWh: "1" }], "2026-10-16"), null);
  assert.equal(tolkStrom([{ NOK_per_kWh: 500 }], "2026-10-16"), null);
});

test("Brreg: enhet og regnskap valideres og gir signaler", () => {
  const enhet = EnhetSchema.parse({
    organisasjonsnummer: "999000114",
    navn: "Testbedrift AS",
    organisasjonsform: { kode: "AS" },
    forretningsadresse: { adresse: ["Gate 1"], postnummer: "5003", poststed: "BERGEN", kommune: "BERGEN" },
    konkurs: false,
    sisteInnsendteAarsregnskap: "2023",
    ukjentFelt: "ignoreres",
  });
  const regnskap = RegnskapListeSchema.parse([
    {
      regnskapstype: "SELSKAP",
      valuta: "NOK",
      regnskapsperiode: { tilDato: "2023-12-31" },
      resultatregnskapResultat: { aarsresultat: -100, driftsresultat: { driftsresultat: -50, driftsinntekter: { sumDriftsinntekter: 1000 } } },
      egenkapitalGjeld: { egenkapital: { sumEgenkapital: -10 }, gjeldOversikt: { sumGjeld: 500, kortsiktigGjeld: { sumKortsiktigGjeld: 400 } } },
      eiendeler: { sumEiendeler: 490, sumBankinnskuddOgKontanter: 20, omloepsmidler: { sumOmloepsmidler: 200 } },
    },
  ]);
  const d = tilDetaljer(enhet, null, regnskap, 2026, ["roller"]);
  assert.equal(d.regnskap?.aar, 2023);
  assert.equal(d.kommune, "BERGEN");
  assert.deepEqual(d.mangler, ["roller"]);
  assert.equal(d.dagligLeder, null);
  assert.ok(d.signaler.some((s) => s.includes("2025 skulle vært levert")));
  assert.ok(d.signaler.includes("Negativ egenkapital i siste regnskap."));
  assert.ok(d.signaler.some((s) => s.startsWith("Likviditetsgrad 1 er 0,50")));
  assert.equal(EnhetSchema.safeParse({ organisasjonsnummer: "123", navn: "X" }).success, false);
});
