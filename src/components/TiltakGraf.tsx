"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { kr, tusen } from "@/lib/format";
import { FARGE } from "./PrognoseGraf";

export interface TiltakRad {
  navn: string;
  margin: number;
  sannsynlighet: number;
  type: "basis" | "tiltak" | "valgt" | "pakke";
}

// Margin til insolvensgrensen på det laveste punktet. 0 = grensen.
export function TiltakGraf({ rader, grenseNavn = "Insolvensgrense" }: { rader: TiltakRad[]; grenseNavn?: string }) {
  const storst = Math.max(...rader.map((r) => Math.abs(r.margin)), 100_000);
  const steg = [50_000, 100_000, 250_000, 500_000, 1_000_000].find((s) => storst / s <= 3) ?? 2_000_000;
  const maks = Math.ceil((storst * 1.15) / steg) * steg;
  const ticks = Array.from({ length: (2 * maks) / steg + 1 }, (_, i) => -maks + i * steg);
  const farge = (r: TiltakRad) => (r.margin < 0 ? FARGE.kritisk : r.type === "pakke" || r.type === "valgt" ? FARGE.prognose : "#2e8b7a");

  return (
    <div style={{ height: 36 + rader.length * 30 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rader} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="#eef0f3" />
          <XAxis type="number" domain={[-maks, maks]} ticks={ticks} tickFormatter={(v: number) => tusen(v)} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="navn"
            width={210}
            tick={{ fontSize: 12, fill: "#334155" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            formatter={(v, _n, item) => {
              const r = item.payload as TiltakRad;
              return [`${kr(Number(v))} · sannsynlighet ${Math.round(r.sannsynlighet * 100)} %`, Number(v) < 0 ? "Under grensen" : "Over grensen"];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <ReferenceLine x={0} stroke={FARGE.kritisk} strokeWidth={1.5} strokeDasharray="6 4" label={{ value: grenseNavn, position: "top", fontSize: 11, fill: FARGE.kritisk }} />
          <Bar dataKey="margin" radius={4} isAnimationActive={false} maxBarSize={18}>
            {rader.map((r) => (
              <Cell key={r.navn} fill={farge(r)} />
            ))}
            <LabelList dataKey="margin" position="right" formatter={(v) => tusen(Number(v))} style={{ fontSize: 11, fill: "#334155" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
