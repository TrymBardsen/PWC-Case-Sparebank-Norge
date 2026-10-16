"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Velger hvilken rådgivers portefølje som vises. Lagres i en cookie som serveren leser.
export function RadgiverVelger({ valgt, radgivere }: { valgt: string; radgivere: string[] }) {
  const router = useRouter();
  const [laster, startTransition] = useTransition();
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">Velg rådgiver</span>
      <select
        value={valgt}
        disabled={laster}
        onChange={(e) => {
          document.cookie = `radgiver=${encodeURIComponent(e.target.value)}; path=/; max-age=31536000; samesite=lax`;
          startTransition(() => router.refresh());
        }}
        className="rounded-md border border-slate-300 bg-white py-0.5 pr-7 pl-2 text-sm font-medium text-slate-900 hover:border-slate-400 disabled:opacity-60"
      >
        {radgivere.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}
