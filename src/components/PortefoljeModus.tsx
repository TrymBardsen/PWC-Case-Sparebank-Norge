"use client";

import { useState } from "react";

// Før/etter: samme morgen med og uten Likviditetsradar
export function PortefoljeModus({ radgiver, medAi, utenAi }: { radgiver: string; medAi: React.ReactNode; utenAi: React.ReactNode }) {
  const [modus, setModus] = useState<"med" | "uten">("med");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">God morgen, {radgiver}</h1>
          <p className="text-sm text-slate-600">
            {modus === "med" ? "Dette er det viktigste å gjøre i dag, og hvorfor." : "Slik så morgenen ut før: en kundeliste og en innboks."}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
          <button onClick={() => setModus("uten")} className={`rounded-md px-3 py-1.5 ${modus === "uten" ? "bg-slate-800 text-white" : "text-slate-600"}`}>
            Uten Likviditetsradar
          </button>
          <button onClick={() => setModus("med")} className={`rounded-md px-3 py-1.5 ${modus === "med" ? "bg-teal-700 text-white" : "text-slate-600"}`}>
            Med Likviditetsradar
          </button>
        </div>
      </div>
      {modus === "med" ? medAi : utenAi}
    </div>
  );
}
