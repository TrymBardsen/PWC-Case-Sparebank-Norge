"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Prognose } from "@/lib/prognose";
import { kortDato } from "@/lib/dato";
import { kr, mnok, tusen } from "@/lib/format";

interface Punkt {
  dato: string;
  historikk?: number;
  prognose?: number;
  sammenlign?: number;
  band?: [number, number];
}

export const FARGE = {
  prognose: "#0f766e",
  historikk: "#475569",
  sammenlign: "#94a3b8",
  kritisk: "#dc2626",
  varsel: "#d97706",
};

export function PrognoseGraf({
  historikk,
  prognose,
  sammenlign,
  sammenlignNavn = "Uten tiltak",
}: {
  historikk: { dato: string; saldo: number }[];
  prognose: Prognose;
  sammenlign?: Prognose;
  sammenlignNavn?: string;
}) {
  const punkter: Punkt[] = historikk.slice(-42).map((d) => ({ dato: d.dato, historikk: d.saldo }));
  const siste = punkter[punkter.length - 1];
  siste.prognose = siste.historikk;
  if (sammenlign) siste.sammenlign = siste.historikk;
  prognose.dager.forEach((d, i) => {
    punkter.push({
      dato: d.dato,
      prognose: d.saldo,
      sammenlign: sammenlign?.dager[i]?.saldo,
      band: [d.saldo - d.bredde, d.saldo + d.bredde],
    });
  });

  const grense = -prognose.ramme;
  const sammenlignGrense = sammenlign && sammenlign.ramme !== prognose.ramme ? -sammenlign.ramme : null;
  const verdier = punkter.flatMap((p) => [p.historikk, p.prognose, p.sammenlign, p.band?.[0], p.band?.[1]].filter((x): x is number => x !== undefined));
  const raaMin = Math.min(...verdier, grense * 1.15);
  const raaMax = Math.max(...verdier, 0);
  const steg = [50_000, 100_000, 250_000, 500_000, 1_000_000].find((s) => (raaMax - raaMin) / s <= 7) ?? 2_000_000;
  const min = Math.floor(raaMin / steg) * steg;
  const max = Math.ceil(raaMax / steg) * steg;
  const ticks = Array.from({ length: Math.round((max - min) / steg) + 1 }, (_, i) => min + i * steg);
  const idag = prognose.dager[0].dato;
  const brudd = prognose.tomKasseDato ? prognose.dager.find((d) => d.dato === prognose.tomKasseDato) : undefined;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={punkter} margin={{ top: 12, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          {/* Soner: betalingsudyktig under grensen, varselsone de siste 10 % av rammen */}
          <ReferenceArea y1={min} y2={grense} fill={FARGE.kritisk} fillOpacity={0.07} ifOverflow="hidden" />
          <ReferenceArea y1={grense} y2={grense * 0.9} fill={FARGE.varsel} fillOpacity={0.07} ifOverflow="hidden" />
          <XAxis dataKey="dato" tickFormatter={kortDato} interval={13} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis domain={[min, max]} ticks={ticks} tickFormatter={(v: number) => tusen(v)} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={60} />
          <Tooltip
            labelFormatter={(l) => kortDato(String(l))}
            formatter={(v, navn) => {
              if (Array.isArray(v)) return [`${kr(Number(v[0]))} – ${kr(Number(v[1]))}`, "80 %-intervall"];
              const tall = Number(v);
              return [`${kr(tall)}${tall < grense ? " (under grensen)" : ""}`, String(navn)];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area dataKey="band" stroke="none" fill={FARGE.prognose} fillOpacity={0.1} name="80 %-intervall" isAnimationActive={false} />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          {sammenlignGrense !== null && <ReferenceLine y={sammenlignGrense} stroke={FARGE.kritisk} strokeOpacity={0.35} strokeDasharray="2 4" />}
          <ReferenceLine
            y={grense}
            stroke={FARGE.kritisk}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            label={{ value: `Insolvensgrense ${mnok(grense)}`, position: "insideBottomRight", fontSize: 11, fill: FARGE.kritisk, fontWeight: 600 }}
          />
          <ReferenceLine x={idag} stroke="#94a3b8" strokeDasharray="2 3" label={{ value: "I dag", position: "insideTopRight", fontSize: 11, fill: "#64748b" }} />
          <Line dataKey="historikk" name="Saldo (faktisk)" stroke={FARGE.historikk} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          {sammenlign && <Line dataKey="sammenlign" name={sammenlignNavn} stroke={FARGE.sammenlign} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
          <Line dataKey="prognose" name="Prognose" stroke={FARGE.prognose} strokeWidth={2.2} dot={false} isAnimationActive={false} />
          {brudd && (
            <ReferenceDot
              x={brudd.dato}
              y={brudd.saldo}
              r={5}
              fill={FARGE.kritisk}
              stroke="#fff"
              strokeWidth={2}
              label={{ value: `Passeres ${kortDato(brudd.dato)}`, position: "top", fontSize: 11, fill: FARGE.kritisk, fontWeight: 600 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Sannsynlighet for å være under insolvensgrensen, uke for uke
export function Risikostripe({ prognose }: { prognose: Prognose }) {
  return (
    <div>
      <div className="mb-1 text-xs text-slate-500">Sannsynlighet for å være under insolvensgrensen, per uke</div>
      <div className="grid grid-cols-13 gap-0.5" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
        {prognose.uker.map((u) => {
          const p = u.sannsynlighet;
          return (
            <div
              key={u.nr}
              title={`Uke fra ${kortDato(u.fra)}: ${Math.round(p * 100)} %`}
              className="tall rounded-sm py-1 text-center text-[10px] font-medium"
              style={{ background: `rgba(220, 38, 38, ${0.06 + p * 0.85})`, color: p > 0.45 ? "#fff" : "#475569" }}
            >
              {Math.round(p * 100)} %
            </div>
          );
        })}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
        <span>{kortDato(prognose.uker[0].fra)}</span>
        <span>{kortDato(prognose.uker[prognose.uker.length - 1].fra)}</span>
      </div>
    </div>
  );
}
