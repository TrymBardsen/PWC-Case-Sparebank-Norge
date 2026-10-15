"use client";

import { useState } from "react";

// Før/etter: samme morgen med og uten Likviditetsradar
export function PortefoljeModus({ medAi, utenAi }: { medAi: React.ReactNode; utenAi: React.ReactNode }) {
  const [modus, setModus] = useState<"med" | "uten">("med");
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
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
