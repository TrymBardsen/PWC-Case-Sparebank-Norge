"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Prognose } from "@/lib/prognose";
import { kortDato } from "@/lib/dato";
import { kr, tusen } from "@/lib/format";

interface Punkt {
  dato: string;
  historikk?: number;
  prognose?: number;
  basis?: number;
  band?: [number, number];
}

export function PrognoseGraf({
  historikk,
  prognose,
  basis,
}: {
  historikk: { dato: string; saldo: number }[];
  prognose: Prognose;
  basis?: Prognose; // vises stiplet når et scenario er aktivt
}) {
  const punkter: Punkt[] = historikk.slice(-42).map((d) => ({ dato: d.dato, historikk: d.saldo }));
  // Koble linjene sammen i dagens punkt
  punkter[punkter.length - 1].prognose = punkter[punkter.length - 1].historikk;
  if (basis) punkter[punkter.length - 1].basis = punkter[punkter.length - 1].historikk;
  prognose.dager.forEach((d, i) => {
    punkter.push({
      dato: d.dato,
      prognose: d.saldo,
      basis: basis?.dager[i]?.saldo,
      band: [d.saldo - d.bredde, d.saldo + d.bredde],
    });
  });

  const idag = prognose.dager[0].dato;
  const verdier = punkter.flatMap((p) => [p.historikk, p.prognose, p.basis, p.band?.[0], p.band?.[1]].filter((x): x is number => x !== undefined));
  const raaMin = Math.min(...verdier, -prognose.ramme);
  const raaMax = Math.max(...verdier, 0);
  const steg = [50_000, 100_000, 250_000, 500_000, 1_000_000].find((s) => (raaMax - raaMin) / s <= 7) ?? 2_000_000;
  const min = Math.floor(raaMin / steg) * steg;
  const max = Math.ceil(raaMax / steg) * steg;
  const ticks = Array.from({ length: Math.round((max - min) / steg) + 1 }, (_, i) => min + i * steg);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={punkter} margin={{ top: 10, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          <XAxis
            dataKey="dato"
            tickFormatter={kortDato}
            interval={13}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            domain={[min, max]}
            ticks={ticks}
            tickFormatter={(v: number) => tusen(v)}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            labelFormatter={(l) => kortDato(String(l))}
            formatter={(v, navn) => {
              if (Array.isArray(v)) return [`${kr(Number(v[0]))} – ${kr(Number(v[1]))}`, "Usikkerhet"];
              return [kr(Number(v)), String(navn)];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area dataKey="band" stroke="none" fill="#0f766e" fillOpacity={0.08} name="Usikkerhet" isAnimationActive={false} />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          <ReferenceLine
            y={-prognose.ramme}
            stroke="#dc2626"
            strokeDasharray="5 4"
            label={{ value: `Kassekredittramme ${tusen(-prognose.ramme)}`, position: "insideBottomLeft", fontSize: 11, fill: "#dc2626" }}
          />
          <ReferenceLine x={idag} stroke="#94a3b8" strokeDasharray="2 3" label={{ value: "I dag", position: "insideTopRight", fontSize: 11, fill: "#64748b" }} />
          {prognose.tomKasseDato && <ReferenceLine x={prognose.tomKasseDato} stroke="#dc2626" />}
          <Line dataKey="historikk" name="Saldo (faktisk)" stroke="#475569" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          {basis && <Line dataKey="basis" name="Uten endringer" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
          <Line dataKey="prognose" name="Prognose" stroke="#0f766e" strokeWidth={2.2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
