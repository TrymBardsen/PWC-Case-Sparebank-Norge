import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { hentMakro } from "@/lib/makro";
import { langDato } from "@/lib/dato";
import { portefolje } from "@/lib/data";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Likviditetsradar",
  description: "Tidligvarsling av likviditetsskvis for rådgivere i bedriftsmarkedet",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const makro = await hentMakro();
  return (
    <html lang="nb">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-teal-700 text-sm text-white">◎</span>
              Likviditetsradar
            </Link>
            <nav className="flex gap-5 text-sm text-slate-600">
              <Link href="/" className="hover:text-slate-900">Portefølje</Link>
              <Link href="/sok" className="hover:text-slate-900">Søk i Enhetsregisteret</Link>
              <Link href="/om" className="hover:text-slate-900">Om løsningen</Link>
            </nav>
            <div className="ml-auto flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span title={`Norges Bank, ${makro.styringsrenteDato}`}>
                Styringsrente <b className="tall text-slate-800">{makro.styringsrente.toFixed(2).replace(".", ",")} %</b>
                {makro.live.rente && <span className="ml-1 text-emerald-600">●</span>}
              </span>
              <span title={`hvakosterstrommen.no, snitt ${makro.stromDato}`}>
                Strøm NO5 <b className="tall text-slate-800">{makro.stromNO5.toFixed(2).replace(".", ",")} kr/kWh</b>
                {makro.live.strom && <span className="ml-1 text-emerald-600">●</span>}
              </span>
              <span className="rounded bg-slate-100 px-2 py-1">
                {portefolje.radgiver} · BM Bergen · {langDato(portefolje.dagensDato)}
              </span>
            </div>
          </div>
        </header>
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-center text-xs text-amber-900">
          Demo: fiktiv kundebase (kundedata.json) og syntetiske bankdata (tilleggsdata.json). Konkursstatistikk (SSB), Enhetsregisteret, styringsrente og strømpris er ekte, åpne data.
        </div>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
