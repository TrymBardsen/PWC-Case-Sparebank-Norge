"use client";

// Handlinger på kundesiden som i produksjon går til CRM og saksbehandling. I demoen lagres de i nettleseren.

import { useEffect, useState } from "react";
import { DAGENS_DATO, langDato } from "@/lib/dato";
import { lesLokal, loggOppfolging, useLokal, type Deling, type Kreditsak } from "@/lib/lokal";
import type { Niva } from "@/lib/score";

function Modal({ tittel, undertittel, onLukk, children }: { tittel: string; undertittel?: string; onLukk: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onLukk}>
      <div role="dialog" aria-label={tittel} className="w-full max-w-lg rounded-xl bg-white p-5 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-slate-900">{tittel}</div>
        {undertittel && <div className="mb-3 text-xs text-slate-500">{undertittel}</div>}
        {children}
      </div>
    </div>
  );
}

const knapp = "rounded-md px-3 py-1.5 text-xs font-semibold";
const primar = `${knapp} bg-snb-rod text-white hover:bg-snb-rod-mork disabled:opacity-50`;
const sekundar = `${knapp} border border-slate-200 bg-white text-slate-700 hover:border-slate-400`;

// ---- Siden sist: hva er endret siden rådgiveren sist åpnet kunden i denne nettleseren ----
export interface Oyeblikk {
  dato: string;
  score: number;
  niva: Niva;
  tom: string | null;
  sannsynlighet: number;
  kk: number;
}

export function SidenSist({ kundeId, naa }: { kundeId: string; naa: Oyeblikk }) {
  const [forrige, setForrige] = useState<Oyeblikk | null | undefined>(undefined);
  useEffect(() => {
    const nokkel = `sett:${kundeId}`;
    const lagret = lesLokal<Oyeblikk | null>(nokkel, null);
    setForrige(lagret);
    // Lagre dagens tilstand, men behold sammenligningen med forrige dag gjennom dagen
    if (!lagret || lagret.dato !== DAGENS_DATO) localStorage.setItem(nokkel, JSON.stringify(naa));
  }, [kundeId, naa]);
  if (forrige === undefined) return null;
  if (forrige === null) return <p className="text-xs text-slate-500">Første gang du åpner kunden i denne nettleseren. Endringer vises her neste gang.</p>;
  if (forrige.dato === DAGENS_DATO) return null;
  const endringer = [
    forrige.score !== naa.score && `score ${forrige.score} → ${naa.score}${forrige.niva !== naa.niva ? ` (${forrige.niva} → ${naa.niva})` : ""}`,
    forrige.tom !== naa.tom && `grensen passeres ${naa.tom ? langDato(naa.tom) : "ikke lenger"}${forrige.tom ? ` (før: ${langDato(forrige.tom)})` : ""}`,
    Math.abs(forrige.kk - naa.kk) >= 0.05 && `kassekreditt brukt ${Math.round(forrige.kk * 100)} % → ${Math.round(naa.kk * 100)} %`,
  ].filter(Boolean);
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">
      <b>Siden du sist så på kunden ({langDato(forrige.dato)}):</b> {endringer.length ? endringer.join(" · ") : "ingen vesentlige endringer."}
    </p>
  );
}

// ---- Del kunden med en kollega eller spesialenhet ----
export function DelKunde({ kundeId, kundenavn, fra, kolleger }: { kundeId: string; kundenavn: string; fra: string; kolleger: string[] }) {
  const mottakere = [...kolleger.filter((k) => k !== fra), "Spesialenhet"];
  const [apen, setApen] = useState(false);
  const [til, setTil] = useState(mottakere[0]);
  const [melding, setMelding] = useState("");
  const [deler, setDeler] = useLokal<Deling[]>("delt", []);
  const delt = deler.filter((d) => d.kundeId === kundeId);
  return (
    <>
      <button onClick={() => setApen(true)} className={sekundar}>
        Del med kollega{delt.length ? ` (${delt.length})` : ""}
      </button>
      {apen && (
        <Modal tittel={`Del ${kundenavn}`} undertittel="Mottakeren får kunden i agendaen sin, med historikken på kundesiden." onLukk={() => setApen(false)}>
          <label className="block text-xs text-slate-600">
            Til
            <select value={til} onChange={(e) => setTil(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {mottakere.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <textarea
            value={melding}
            onChange={(e) => setMelding(e.target.value)}
            rows={3}
            placeholder="Hva skal kollegaen se på?"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
          {delt.length > 0 && <p className="mt-1 text-xs text-slate-500">Delt før: {delt.map((d) => `${d.til} (${langDato(d.dato)})`).join(", ")}</p>}
          <div className="mt-3 flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">Demo: lagres i denne nettleseren.</span>
            <span className="flex gap-2">
              <button onClick={() => setApen(false)} className={sekundar}>
                Avbryt
              </button>
              <button
                className={primar}
                onClick={() => {
                  setDeler([...deler, { kundeId, kundenavn, fra, til, melding: melding.trim(), dato: DAGENS_DATO }]);
                  loggOppfolging(kundeId, fra, `Delt med ${til}${melding.trim() ? `: ${melding.trim()}` : "."}`, "Delt med kollega");
                  setMelding("");
                  setApen(false);
                }}
              >
                Del
              </button>
            </span>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---- Send tiltak til kredittvurdering, forhåndsutfylt ----
export interface KredittUtkast {
  tiltak: { navn: string; betalingslettelse: boolean }[];
  tekst: string; // forhåndsutfylt begrunnelse med tall
}

export function SendTilKreditt({ kundeId, kundenavn, radgiver, utkast, liten }: { kundeId: string; kundenavn: string; radgiver: string; utkast: KredittUtkast; liten?: boolean }) {
  const [apen, setApen] = useState(false);
  const [tekst, setTekst] = useState(utkast.tekst);
  const [saker, setSaker] = useLokal<Kreditsak[]>(`kreditt:${kundeId}`, []);
  const sendt = saker.at(-1);
  return (
    <>
      <button onClick={() => setApen(true)} className={liten ? "text-xs font-semibold text-snb-rod hover:underline" : primar}>
        {sendt ? `Sendt til kreditt ${langDato(sendt.dato)} · send ny` : "Send til kredittvurdering"}
      </button>
      {apen && (
        <Modal tittel={`Kredittsak: ${kundenavn}`} undertittel="Forhåndsutfylt fra prognosen og tiltakene. Rediger før du sender." onLukk={() => setApen(false)}>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {utkast.tiltak.map((t) => (
              <span key={t.navn} className="rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-medium text-orange-800 ring-1 ring-orange-200 ring-inset">
                {t.navn}
                {t.betalingslettelse ? " · betalingslettelse" : ""}
              </span>
            ))}
          </div>
          <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={9} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600" />
          <div className="mt-3 flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">Demo: ingen ekte saksflyt. Saken logges på kunden.</span>
            <span className="flex gap-2">
              <button onClick={() => setApen(false)} className={sekundar}>
                Avbryt
              </button>
              <button
                className={primar}
                onClick={() => {
                  const navn = utkast.tiltak.map((t) => t.navn);
                  setSaker([...saker, { dato: DAGENS_DATO, tiltak: navn, begrunnelse: tekst, status: "Sendt" }]);
                  loggOppfolging(kundeId, radgiver, `Sendt til kredittvurdering: ${navn.join(", ")}.`, "Sendt til kreditt");
                  setApen(false);
                }}
              >
                Send
              </button>
            </span>
          </div>
        </Modal>
      )}
    </>
  );
}

export function Kreditsaker({ kundeId }: { kundeId: string }) {
  const [saker] = useLokal<Kreditsak[]>(`kreditt:${kundeId}`, []);
  if (!saker.length) return <p className="text-sm text-slate-500">Ingen saker sendt til kredittvurdering.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {saker.map((s, i) => (
        <li key={i} className="border-l-2 border-orange-300 pl-3">
          <div className="text-xs text-slate-500">
            {langDato(s.dato)} · {s.status}
          </div>
          <div className="font-medium text-slate-900">{s.tiltak.join(", ")}</div>
        </li>
      ))}
    </ul>
  );
}

// ---- Be kunden om tilgang til regnskapsdata ----
export function BeOmTilgang({ kundeId, dagligLeder, radgiver }: { kundeId: string; dagligLeder: string; radgiver: string }) {
  const nokkel = `samtykkeforesporsel:${kundeId}`;
  const [sendt, setSendt] = useLokal<string | null>(nokkel, null);
  const [apen, setApen] = useState(false);
  const [tekst, setTekst] = useState(
    `Hei ${dagligLeder.split(" ")[0]}.\n\nFor at vi skal kunne gi dere bedre råd om likviditeten, ønsker vi lesetilgang til regnskapssystemet deres (kundefordringer og leverandørgjeld). Da ser vi hvem som skylder dere penger og når, og vi kan vurdere tiltak som factoring.\n\nDere kan når som helst trekke tilgangen tilbake. Godkjenn her: [lenke til samtykke]\n\nVennlig hilsen\n${radgiver}`,
  );
  if (sendt) return <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-900">Forespørsel om tilgang sendt {langDato(sendt)}. Venter på svar fra kunden.</p>;
  return (
    <>
      <button onClick={() => setApen(true)} className={`mt-3 ${primar}`}>
        Be om tilgang til regnskapsdata
      </button>
      {apen && (
        <Modal tittel="Be om tilgang til regnskapsdata" undertittel="Kunden godkjenner selv i regnskapssystemet. Forhåndsutfylt, rediger fritt." onLukk={() => setApen(false)}>
          <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={10} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600" />
          <div className="mt-3 flex justify-between gap-2">
            <span className="text-[11px] text-slate-500">Demo: sendes ikke. Ekte samtykkeflyt finnes ikke i prototypen.</span>
            <span className="flex gap-2">
              <button onClick={() => setApen(false)} className={sekundar}>
                Avbryt
              </button>
              <button
                className={primar}
                onClick={() => {
                  setSendt(DAGENS_DATO);
                  loggOppfolging(kundeId, radgiver, "Forespørsel om tilgang til regnskapsdata sendt.", "Samtykke forespurt");
                  setApen(false);
                }}
              >
                Send forespørsel
              </button>
            </span>
          </div>
        </Modal>
      )}
    </>
  );
}
