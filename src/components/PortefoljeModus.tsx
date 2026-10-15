"use client";

import { useState } from "react";

// Før/etter: samme morgen med og uten Likviditetsradar
export function PortefoljeModus({ radgiver, medAi, utenAi }: { radgiver: string; medAi: React.ReactNode; utenAi: React.ReactNode }) {
  const [modus, setModus] = useState<"med" | "uten">("med");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="overtittel mb-1">Porteføljeradar</div>
          <h1 className="font-overskrift text-3xl font-bold text-snb-rod">God morgen, {radgiver}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {modus === "med" ? "Dette er det viktigste å gjøre i dag, og hvorfor." : "Slik så morgenen ut før: en kundeliste og en innboks."}
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-snb-gra p-1 text-sm">
          <button onClick={() => setModus("uten")} className={`rounded-md px-3 py-1.5 ${modus === "uten" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
            Uten Likviditetsradaren
          </button>
          <button onClick={() => setModus("med")} className={`rounded-md px-3 py-1.5 ${modus === "med" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
            Med Likviditetsradaren
          </button>
        </div>
      </div>
      {modus === "med" ? medAi : utenAi}
    </div>
  );
}
