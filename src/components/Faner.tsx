"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Fanerad i bankens stil: grått felt, aktiv fane hvit
export function Faner({ toppKunde }: { toppKunde?: string }) {
  const sti = usePathname();
  const faner = [
    { href: "/", tekst: "1. Porteføljeradar", aktiv: sti === "/" },
    { href: sti.startsWith("/kunde/") ? sti : `/kunde/${toppKunde ?? ""}`, tekst: "2. Kundeanalyse", aktiv: sti.startsWith("/kunde/") },
    { href: "/sok", tekst: "3. Søk i Enhetsregisteret", aktiv: sti === "/sok" },
    { href: "/om", tekst: "Slik fungerer det", aktiv: sti === "/om" },
  ];
  return (
    <nav className="flex flex-wrap justify-center gap-1 rounded-lg bg-snb-gra p-1.5">
      {faner.map((f) => (
        <Link
          key={f.tekst}
          href={f.href}
          className={`rounded-md px-4 py-2 text-[15px] transition ${f.aktiv ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
        >
          {f.tekst}
        </Link>
      ))}
    </nav>
  );
}
