"use client";

import { useEffect, useState } from "react";
import { BriefSchema, type Brief } from "@/lib/brief";
import { lesSvar } from "@/lib/rapport";
import { DAGENS_DATO, langDato } from "@/lib/dato";
import { loggOppfolging } from "@/lib/lokal";
import { Kort } from "./ui";

const MAKS_VENTETID = 8 * 60_000;

// Tekstversjon av underlaget, til utklippstavlen
function somTekst(b: Brief): string {
  return [
    b.oppsummering,
    "",
    `Åpning: «${b.apning}»`,
    "",
    "Hva har skjedd:",
    ...b.hvaHarSkjedd.map((h) => `• ${h.punkt} (${h.kilde})`),
    "",
    "Spørsmål:",
    ...b.sporsmal.map((x, i) => `${i + 1}. ${x}`),
    "",
    "Mulige tiltak:",
    ...b.tiltak.map((t, i) => `${i + 1}. ${t.navn}: ${t.effekt} Forbehold: ${t.forbehold}`),
  ].join("\n");
}

// Utkast til møtereferat: rådgiveren fyller inn hva kunden svarte og hva som ble avtalt
function referatUtkast(b: Brief, radgiver: string): string {
  return [
    `Møte ${langDato(DAGENS_DATO)} · ${radgiver}`,
    "",
    "Bakgrunn:",
    b.oppsummering,
    "",
    "Kundens svar:",
    ...b.sporsmal.map((x) => `• ${x}\n  Svar: `),
    "",
    "Avtalt:",
    ...b.tiltak.slice(0, 2).map((t) => `• ${t.navn}: [avtalt / ikke aktuelt / vurderes]`),
    "",
    "Neste steg:",
  ].join("\n");
}

export function AiBrief({ kundeId, radgiver }: { kundeId: string; radgiver: string }) {
  const [kopiert, setKopiert] = useState(false);
  const [referat, setReferat] = useState<string | null>(null);
  const [referatLagret, setReferatLagret] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [merknad, setMerknad] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);
  const [jobb, setJobb] = useState<{ id: string; start: number } | null>(null);
  const [sekunder, setSekunder] = useState(0);

  // Legger forespørselen i køen som Claude Desktop svarer på
  async function generer() {
    setMerknad(null);
    const res = await fetch("/api/brief/generer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kundeId }) });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { feil?: string } | null;
      setMerknad(json?.feil ?? "Kunne ikke starte samtaleunderlaget.");
      return;
    }
    const { jobbId } = (await res.json()) as { jobbId: string };
    setSekunder(0);
    setJobb({ id: jobbId, start: Date.now() });
  }

  useEffect(() => {
    if (!jobb) return;
    const t = setInterval(async () => {
      setSekunder(Math.round((Date.now() - jobb.start) / 1000));
      const res = await fetch(`/api/rapport/status?jobb=${encodeURIComponent(jobb.id)}`, { cache: "no-store" });
      if (res.ok) {
        const s = (await res.json()) as { status: string; svar?: string };
        if (s.status === "ferdig" && s.svar) {
          clearInterval(t);
          setJobb(null);
          let data: unknown;
          try {
            data = lesSvar(s.svar);
          } catch {
            setMerknad("Svaret fra Claude Desktop er ikke gyldig JSON. Prøv igjen, eller bruk den regelbaserte malen.");
            return;
          }
          const tolket = BriefSchema.safeParse(data);
          if (!tolket.success) {
            const f = tolket.error.issues[0];
            setMerknad(`Svaret fulgte ikke skjemaet (${f?.path.join(".") || "rot"}: ${f?.message}). Prøv igjen, eller bruk den regelbaserte malen.`);
            return;
          }
          setBrief({ ...tolket.data, kilde: "claude", modell: "Claude Desktop" });
          return;
        }
      }
      if (Date.now() - jobb.start > MAKS_VENTETID) {
        clearInterval(t);
        setJobb(null);
        setMerknad("Fikk ikke svar innen 8 minutter. Er Claude-økten som behandler køen åpen? Du kan bruke den regelbaserte malen i stedet.");
      }
    }, 2000);
    return () => clearInterval(t);
  }, [jobb]);

  // Regelbasert mal (eller Claude via API-nøkkel hvis den er satt)
  async function hent() {
    setLaster(true);
    setMerknad(null);
    try {
      const res = await fetch("/api/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kundeId }) });
      const json = (await res.json()) as { brief: Brief; merknad?: string };
      setBrief(json.brief);
      setMerknad(json.merknad ?? null);
    } catch {
      setMerknad("Kunne ikke hente samtaleunderlag.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <Kort
      tittel="Samtaleunderlag"
      hoyre={
        brief && (
          <span className="rounded bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800 ring-1 ring-violet-200 ring-inset">
            {brief.kilde === "claude" ? `AI-utkast · ${brief.modell}` : "Regelbasert mal"}
          </span>
        )
      }
    >
      {!brief && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Lag et forslag til samtale med kunden: hva som har skjedd, hvilke spørsmål du bør stille og hvilke tiltak som kan hjelpe. Bygger bare på tallene og
            notatene på denne siden.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={generer}
              disabled={laster || jobb !== null}
              className="rounded-md bg-snb-rod px-5 py-2.5 text-sm font-semibold text-white hover:bg-snb-rod-mork disabled:opacity-60"
            >
              {jobb ? `Venter på Claude Desktop … ${sekunder} s` : "Lag samtaleunderlag"}
            </button>
            {jobb && (
              <button onClick={() => setJobb(null)} className="text-sm font-semibold text-slate-600 hover:underline">
                Avbryt
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Svaret lages av Claude Code-økten i Claude Desktop og tar vanligvis under et minutt. Prompten inneholder kundens beregnede fakta og notater. Bruk bare
            fiktive data.{" "}
            <button onClick={hent} disabled={laster || jobb !== null} className="font-semibold text-snb-rod hover:underline disabled:opacity-50">
              {laster ? "Lager mal …" : "Trenger du det nå? Bruk en enkel mal uten AI."}
            </button>
          </p>
        </div>
      )}

      {brief && (
        <div className="space-y-4 text-sm">
          <p className="font-medium text-slate-900">{brief.oppsummering}</p>

          <div className="rounded-lg border-l-4 border-teal-600 bg-teal-50 px-3 py-2 text-teal-950">
            <div className="text-xs font-medium text-teal-800">Forslag til åpning</div>
            «{brief.apning}»
          </div>

          <Seksjon tittel="Hva har skjedd">
            <ul className="space-y-1.5">
              {brief.hvaHarSkjedd.map((h, i) => (
                <li key={i}>
                  {h.punkt} <span className="text-xs text-slate-400">({h.kilde})</span>
                </li>
              ))}
            </ul>
          </Seksjon>

          <Seksjon tittel="Spørsmål å stille">
            <ol className="list-decimal space-y-1 pl-5">
              {brief.sporsmal.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </Seksjon>

          <Seksjon tittel="Mulige tiltak, mest egnet først">
            <div className="space-y-2">
              {brief.tiltak.map((t, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="font-medium">
                    {i + 1}. {t.navn}
                  </div>
                  <div className="text-slate-700">{t.begrunnelse}</div>
                  <div className="mt-1 text-xs text-teal-800">Effekt: {t.effekt}</div>
                  <div className="text-xs text-slate-500">Forbehold: {t.forbehold}</div>
                </div>
              ))}
            </div>
          </Seksjon>

          {brief.ikkeVurdert.length > 0 && (
            <Seksjon tittel="Dette vet vi ikke">
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                {brief.ikkeVurdert.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </Seksjon>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(somTekst(brief));
                setKopiert(true);
                setTimeout(() => setKopiert(false), 2500);
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400"
            >
              {kopiert ? "Kopiert" : "Kopier"}
            </button>
            <button
              onClick={() => {
                setReferat(referatUtkast(brief, radgiver));
                setReferatLagret(false);
              }}
              className="rounded-md bg-snb-gronn px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Lag møtereferat
            </button>
            <button onClick={generer} disabled={laster || jobb !== null} className="ml-auto text-xs font-semibold text-snb-rod hover:underline disabled:opacity-50">
              {jobb ? `Venter … ${sekunder} s` : "Lag på nytt"}
            </button>
          </div>
          {referat !== null && (
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-1 text-xs font-semibold text-slate-600">Møtereferat – fyll inn svar og avtaler</div>
              <textarea value={referat} onChange={(e) => setReferat(e.target.value)} rows={14} className="w-full rounded-md border border-slate-200 px-2 py-1.5 font-mono text-xs outline-none focus:border-teal-600" />
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => {
                    loggOppfolging(kundeId, radgiver, referat, "Møtereferat");
                    setReferatLagret(true);
                  }}
                  className="rounded-md bg-snb-gronn px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  {referatLagret ? "Lagret i loggen" : "Lagre i kundeloggen"}
                </button>
                <span className="text-[11px] text-slate-500">Sett neste oppfølging i «Notater og oppfølging».</span>
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500">Utkast og beslutningsstøtte. Du tar beslutningen, og betalingslettelser dokumenteres etter retningslinjene.</p>
          {merknad && <p className="text-xs text-amber-700">{merknad}</p>}
        </div>
      )}
      {!brief && merknad && <p className="mt-2 text-xs text-amber-700">{merknad}</p>}
    </Kort>
  );
}

function Seksjon({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">{tittel}</h3>
      {children}
    </div>
  );
}
