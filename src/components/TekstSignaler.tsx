"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Debitor, Tekstkilde } from "@/lib/types";
import { KATEGORI_POENG, KATEGORI_TEKST, verifiserSitat, type Tekstanalyse, type Tekstsignal } from "@/lib/tekst";
import { langDato, visDatoer } from "@/lib/dato";
import { prosent } from "@/lib/format";
import { Kort } from "./ui";

const TYPE_TEKST: Record<Tekstkilde["type"], string> = { notat: "Notat", epost: "E-post", nyhet: "Nyhet", kunngjoring: "Register", bank: "Bankdata" };

function stilFor(s: Tekstsignal) {
  if (s.kategori === "grønn interesse") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (s.kategori === "positiv") return "bg-sky-50 text-sky-800 ring-sky-200";
  if (s.kategori === "klimakrav") return "bg-amber-50 text-amber-800 ring-amber-200";
  return s.alvor === 3 ? "bg-red-50 text-red-800 ring-red-200" : "bg-orange-50 text-orange-800 ring-orange-200";
}

export function TekstSignaler({ kundeId, kilder, analyse: start, debitorer }: { kundeId: string; kilder: Tekstkilde[]; analyse: Tekstanalyse; debitorer: Debitor[] }) {
  const router = useRouter();
  const [analyse, setAnalyse] = useState(start);
  const [laster, setLaster] = useState(false);
  const [merknad, setMerknad] = useState<string | null>(null);
  const [visKilder, setVisKilder] = useState(false);

  async function kjor() {
    setLaster(true);
    setMerknad(null);
    try {
      const res = await fetch("/api/tekstsignaler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kundeId }) });
      const json = (await res.json()) as { analyse: Tekstanalyse; merknad?: string };
      setAnalyse(json.analyse);
      setMerknad(json.merknad ?? null);
      router.refresh(); // scoren bruker den lagrede analysen
    } catch {
      setMerknad("Kunne ikke kjøre tekstanalysen.");
    } finally {
      setLaster(false);
    }
  }

  const signaler = [...analyse.signaler].sort((a, b) => KATEGORI_POENG[b.kategori] * b.alvor - KATEGORI_POENG[a.kategori] * a.alvor);
  const verifisert = signaler.filter((s) => verifiserSitat(s, kilder)).length;
  const kildeFor = (id: string) => kilder.find((k) => k.id === id);

  return (
    <Kort
      tittel="Signaler i tekst"
      hoyre={
        <span className="rounded bg-fuchsia-50 px-2 py-0.5 text-[10px] font-medium text-fuchsia-800 ring-1 ring-fuchsia-200 ring-inset">
          {analyse.metode === "claude" ? `Claude · ${analyse.modell}` : "Regelbasert analyse"}
        </span>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        {kilder.length} kilder: møtenotater, CRM, bankhendelser og registre (Brreg, Doffin, Aa-registeret, byggesak). Hvert signal peker på et ordrett sitat i kilden.
      </p>

      {signaler.length === 0 ? (
        <p className="text-sm text-slate-500">Ingen signaler funnet.</p>
      ) : (
        <ul className="space-y-3">
          {signaler.map((s, i) => {
            const kilde = kildeFor(s.kildeId);
            const debitor = debitorer.find((d) => d.navn === s.gjelderDebitor);
            return (
              <li key={i} className="text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${stilFor(s)}`}>{KATEGORI_TEKST[s.kategori]}</span>
                  {debitor && (
                    <span className="text-[11px] text-slate-600">
                      gjelder <b>{debitor.navn}</b> ({prosent(debitor.andelAvInnbetalinger)} av innbetalingene)
                    </span>
                  )}
                </div>
                <blockquote className="mt-1 border-l-2 border-slate-300 pl-2 text-slate-800 italic">«{visDatoer(s.sitat)}»</blockquote>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {kilde ? `${TYPE_TEKST[kilde.type]} · ${kilde.avsender} · ${langDato(kilde.dato)}` : "Ukjent kilde"}
                  {analyse.metode === "claude" && <span> · {s.oppsummering}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs text-emerald-700">
          ✓ {verifisert} av {signaler.length} sitater funnet ordrett i kilden
          {analyse.forkastet > 0 && <span className="text-slate-500"> · {analyse.forkastet} forslag forkastet fordi sitatet ikke fantes</span>}
        </span>
        <span className="flex gap-3 text-xs">
          <button onClick={() => setVisKilder((v) => !v)} className="font-semibold text-snb-rod hover:underline">
            {visKilder ? "Skjul kilder" : "Vis kilder"}
          </button>
          <button onClick={kjor} disabled={laster} className="rounded-md bg-snb-gronn px-3 py-1.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
            {laster ? "Analyserer …" : "Analyser med Claude"}
          </button>
        </span>
      </div>
      {merknad && <p className="mt-2 text-xs text-amber-700">{merknad}</p>}

      {visKilder && (
        <ul className="mt-3 space-y-3">
          {kilder.map((k) => (
            <li key={k.id} className="rounded-lg bg-slate-50 p-3 text-xs">
              <div className="mb-1 text-slate-500">
                {TYPE_TEKST[k.type]} · {k.avsender} · {langDato(k.dato)}
                
              </div>
              {k.tittel && <div className="font-medium text-slate-800">{k.tittel}</div>}
              <Uthevet tekst={k.tekst} sitater={signaler.filter((s) => s.kildeId === k.id).map((s) => s.sitat)} />
            </li>
          ))}
        </ul>
      )}
    </Kort>
  );
}

// Markerer sitatene i kildeteksten, så rådgiveren ser nøyaktig hva signalet bygger på
function Uthevet({ tekst, sitater }: { tekst: string; sitater: string[] }) {
  const deler: { tekst: string; merket: boolean }[] = [];
  let rest = tekst;
  const sortert = sitater.map((s) => ({ s, i: tekst.indexOf(s) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
  let pos = 0;
  for (const { s, i } of sortert) {
    if (i < pos) continue;
    deler.push({ tekst: tekst.slice(pos, i), merket: false }, { tekst: s, merket: true });
    pos = i + s.length;
  }
  rest = tekst.slice(pos);
  deler.push({ tekst: rest, merket: false });
  return (
    <p className="text-slate-700">
      {deler.map((d, i) =>
        d.merket ? (
          <mark key={i} className="rounded bg-yellow-100 px-0.5 text-slate-900">
            {d.tekst}
          </mark>
        ) : (
          <span key={i}>{d.tekst}</span>
        ),
      )}
    </p>
  );
}
