"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GronnVurdering } from "@/lib/gronn";
import { GRONN_LOPETID_AAR, GRONN_RENTE } from "@/lib/prognose";
import { kr, mnok, prosent, tusen } from "@/lib/format";
import { Kort } from "./ui";

export function GronnKort({ g, klimakrav, aktiv, onVis }: { g: GronnVurdering; klimakrav?: string; aktiv: boolean; onVis: () => void }) {
  const tilbake = Number.isFinite(g.tilbakebetalingAar) ? `${g.tilbakebetalingAar.toFixed(1).replace(".", ",")} år` : "–";
  return (
    <Kort
      tittel="Grønn omstilling som likviditetstiltak"
      hoyre={
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
            g.gjennomforbar ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          {g.gjennomforbar ? "Nødvendig og gjennomførbar" : "Krever mer egenkapital eller lengre løpetid"}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-medium text-slate-900">{g.navn}</div>
            <p className="text-xs text-slate-600">{g.beskrivelse}</p>
          </div>
          {g.nodvendig.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Hvorfor nå</div>
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
                {g.nodvendig.map((n) => (
                  <li key={n} className={n === klimakrav ? "font-medium text-amber-800" : ""}>
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <dl className="tall grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <Felt n="Investering" v={mnok(g.investering)} />
            <Felt n="Enova-støtte (anslag)" v={mnok(g.enovaStotte)} />
            <Felt n={`Grønt lån (${GRONN_LOPETID_AAR} år, ${(GRONN_RENTE * 100).toFixed(1).replace(".", ",")} %)`} v={mnok(g.lanebelop)} />
            <Felt n="Besparelse per år" v={kr(g.besparelsePerAar)} />
            <Felt n="Netto per år (etter termin)" v={kr(g.nettoPerAar)} farge={g.nettoPerAar >= 0 ? "text-emerald-700" : "text-red-600"} />
            <Felt n="Tilbakebetalt" v={tilbake} />
            <Felt
              n="CO₂ spart per år"
              v={`${g.co2TonnPerAar.toFixed(1).replace(".", ",")} tonn`}
              under={g.kwhSpartPerAar > 0 ? `${Math.round(g.kwhSpartPerAar / 1000)} MWh strøm` : undefined}
            />
            <Felt n="Effekt neste 13 uker" v={`${g.likviditetEffekt >= 0 ? "+" : "−"}${kr(Math.abs(g.likviditetEffekt))}`} under="på laveste punkt" />
            <Felt n="Sannsynlighet insolvens" v={`${prosent(g.sannsynlighetFor)} → ${prosent(g.sannsynlighetEtter)}`} />
          </dl>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={onVis} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${aktiv ? "bg-slate-200 text-slate-700" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}>
              {aktiv ? "Fjern fra prognosen" : "Vis i prognosen"}
            </button>
            <span className="text-[11px] text-slate-500">Grønt lån og mellomfinansiering av Enova-støtten gjør investeringen likviditetsnøytral ved oppstart.</span>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs text-slate-500">Akkumulert kontanteffekt etter lånetermin, år 1–10</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={g.kumulativ} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="aar" tickFormatter={(v) => `År ${v}`} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tickFormatter={(v: number) => tusen(v)} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v) => [kr(Number(v)), "Akkumulert"]} labelFormatter={(l) => `År ${l}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "#f1f5f9" }} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="netto" radius={4} maxBarSize={22} isAnimationActive={false}>
                  {g.kumulativ.map((r) => (
                    <Cell key={r.aar} fill={r.netto >= 0 ? "#047857" : "#dc2626"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Strøm regnet med dagens NO5-pris pluss nettleie og avgifter. CO₂ er et forenklet anslag; norsk strøm har lave utslipp, så gevinsten er størst der
            tiltaket erstatter fossilt drivstoff.
          </p>
        </div>
      </div>
    </Kort>
  );
}

function Felt({ n, v, under, farge = "text-slate-900" }: { n: string; v: string; under?: string; farge?: string }) {
  return (
    <div>
      <dt className="text-slate-500">{n}</dt>
      <dd className={`font-medium ${farge}`}>{v}</dd>
      {under && <dd className="text-[10px] text-slate-400">{under}</dd>}
    </div>
  );
}
