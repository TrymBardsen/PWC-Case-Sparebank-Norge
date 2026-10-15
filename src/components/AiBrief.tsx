"use client";

import { useState } from "react";
import type { Brief } from "@/lib/brief";
import { Kort } from "./ui";

export function AiBrief({ kundeId }: { kundeId: string }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [merknad, setMerknad] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

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
          <button
            onClick={hent}
            disabled={laster}
            className="rounded-md bg-snb-rod px-5 py-2.5 text-sm font-semibold text-white hover:bg-snb-rod-mork disabled:opacity-60"
          >
            {laster ? "Forbereder …" : "Forbered samtale"}
          </button>
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

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Beslutningsstøtte. Du tar beslutningen, og betalingslettelser dokumenteres etter retningslinjene.</span>
            <button onClick={hent} disabled={laster} className="shrink-0 font-semibold text-snb-rod hover:underline">
              {laster ? "Lager nytt …" : "Lag på nytt"}
            </button>
          </div>
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
