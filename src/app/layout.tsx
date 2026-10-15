import type { Metadata } from "next";
import Link from "next/link";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { langDato } from "@/lib/dato";
import { hentVurderinger, portefolje } from "@/lib/data";
import { Faner } from "@/components/Faner";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Likviditetsradaren",
  description: "Tidligvarsling av likviditetsskvis for rådgivere i bedriftsmarkedet",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // «Kundeanalyse» åpner kunden som trenger rådgiveren mest
  const { vurderinger } = hentVurderinger();
  const toppKunde = [...vurderinger.values()].sort((a, b) => b.score - a.score)[0]?.kundeId;

  return (
    <html lang="nb">
      <body className={`${inter.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <header className="border-b-[3px] border-snb-rod bg-white print:hidden">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 pt-5 pb-3">
            <Link href="/" className="flex items-center gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sparebanken-norge-logo.png" alt="Sparebanken Norge" width={200} height={40} className="h-10 w-auto" />
              <span className="h-10 w-px bg-slate-200" />
              <span>
                <span className="block font-overskrift text-2xl leading-tight font-bold text-snb-rod italic">Likviditetsradaren</span>
                <span className="block text-xs text-slate-600">Bedriftsmarked · Rådgiverens arbeidsflate</span>
              </span>
            </Link>
          </div>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 pb-4 text-sm text-slate-600">
            <span className="rounded-full bg-snb-rod-lys px-3 py-1 text-xs font-semibold text-snb-rod">Prototype · fiktive data</span>
            <span>
              {portefolje.radgiver}, bedriftsrådgiver · BM Bergen · {langDato(portefolje.dagensDato)}
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-6 print:max-w-none print:p-0">
          <Faner toppKunde={toppKunde} />
          <div className="mt-6 print:mt-0">{children}</div>
        </main>

        <footer className="mx-auto max-w-7xl border-t border-slate-200 px-6 py-5 text-xs text-slate-500 print:hidden">
          Konseptprototype. Kundene (kundedata.json) og bankdataene (tilleggsdata.json) er fiktive og syntetiske. Konkursstatistikk (SSB), Enhetsregisteret,
          styringsrente og strømpris er ekte, åpne data.
        </footer>
      </body>
    </html>
  );
}
