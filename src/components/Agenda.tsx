"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Oppgave, Oppgavetype } from "@/lib/agenda";
import { DAGENS_DATO, kortDato, leggTilDager, ukedag } from "@/lib/dato";
import { lesLokal, loggOppfolging, lokaleNokler, skrivLokal, useLokal, type Deling, type Plan, type Utsatt } from "@/lib/lokal";
import { Kort } from "./ui";

const TYPE: Record<Oppgavetype, { tekst: string; stil: string }> = {
  ring: { tekst: "Ring", stil: "bg-red-50 text-red-800 ring-red-200" },
  folgopp: { tekst: "Følg opp", stil: "bg-orange-50 text-orange-800 ring-orange-200" },
  oppfolging: { tekst: "Lovet oppfølging", stil: "bg-orange-50 text-orange-800 ring-orange-200" },
  delt: { tekst: "Delt med deg", stil: "bg-sky-50 text-sky-800 ring-sky-200" },
  sjekkinn: { tekst: "Tekstsignal", stil: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200" },
  eksponering: { tekst: "Smitte", stil: "bg-amber-50 text-amber-800 ring-amber-200" },
  gronn: { tekst: "Grønn mulighet", stil: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  mulighet: { tekst: "Mulighet", stil: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  mote: { tekst: "Glemt kunde", stil: "bg-slate-100 text-slate-700 ring-slate-200" },
};

const NOKKEL = `agenda:${DAGENS_DATO}`;
// Lukket agenda huskes resten av dagen; en ny dag åpner den igjen
const LUKKET_NOKKEL = `agenda-lukket:${DAGENS_DATO}`;
const UTSATT_NOKKEL = "agenda-utsatt";
const GRUNNER = ["Kjent situasjon, kunden har kontroll", "Allerede håndtert", "Venter på kunden", "Falsk alarm"];

// Tre neste ledige tider på hverdager
function ledigeTider(): string[] {
  const tider: string[] = [];
  let d = DAGENS_DATO;
  while (tider.length < 3) {
    d = leggTilDager(d, 1);
    if (ukedag(d) < 5) tider.push(`${kortDato(d)} kl. ${tider.length % 2 === 0 ? "10.00" : "13.30"}`);
  }
  return tider;
}

type KundeKort = { id: string; navn: string; dagligLeder: string };

export function Agenda({ oppgaver: fraServer, radgiver, kunder }: { oppgaver: Oppgave[]; radgiver: string; kunder: KundeKort[] }) {
  const [ferdig, setFerdig] = useLokal<Record<string, string>>(NOKKEL, {});
  const [lukket, setLukket] = useLokal<boolean>(LUKKET_NOKKEL, false);
  const [utsatt, setUtsatt] = useLokal<Record<string, Utsatt>>(UTSATT_NOKKEL, {});
  const [deler, , lastet] = useLokal<Deling[]>("delt", []);
  const [melding, setMelding] = useState<{ oppgave: Oppgave; tekst: string } | null>(null);
  const [booker, setBooker] = useState<string | null>(null);
  const [utsetter, setUtsetter] = useState<string | null>(null);
  const [visUtsatte, setVisUtsatte] = useState(false);
  const [planEndret, setPlanEndret] = useState(0);

  // Oppgaver som bare finnes i nettleseren: lovet oppfølging som forfaller, og kunder delt med meg.
  // Leses først etter at siden er lastet i nettleseren (lastet), så server og klient viser det samme først.
  const ekstra = useMemo<Oppgave[]>(() => {
    void planEndret;
    if (!lastet) return [];
    const navn = new Map(kunder.map((k) => [k.id, k]));
    const lovet = lokaleNokler("plan:")
      .map((n) => ({ id: n.slice(5), plan: lesLokal<Plan | null>(n, null) }))
      .filter((x): x is { id: string; plan: Plan } => Boolean(x.plan && navn.has(x.id) && x.plan.nesteDato <= DAGENS_DATO))
      .map(({ id, plan }): Oppgave => {
        const k = navn.get(id)!;
        return {
          id: `oppfolging-${id}`,
          kundeId: id,
          kundenavn: k.navn,
          kontakt: k.dagligLeder,
          type: "oppfolging",
          tittel: `Følg opp ${k.navn}`,
          grunn: plan.lovet ? `Du lovet: ${plan.lovet}` : "Oppfølgingsdatoen du satte, er nådd.",
          frist: plan.nesteDato < DAGENS_DATO ? `Forfalt ${kortDato(plan.nesteDato)}` : "I dag",
          minutterUten: 0,
          minutterMed: 0,
          melding: `Hei ${k.dagligLeder.split(" ")[0]}.\n\nJeg følger opp det vi snakket om sist. Har du tid til en kort prat denne uken?\n\nVennlig hilsen\n${radgiver}`,
        };
      });
    const delt = deler
      .filter((d) => d.til === radgiver)
      .map(
        (d): Oppgave => ({
          id: `delt-${d.kundeId}-${d.dato}`,
          kundeId: d.kundeId,
          kundenavn: d.kundenavn,
          kontakt: "kunden",
          type: "delt",
          tittel: `${d.fra} delte ${d.kundenavn} med deg`,
          grunn: d.melding || "Ingen melding.",
          frist: "Denne uken",
          minutterUten: 0,
          minutterMed: 0,
          melding: "",
        }),
      );
    return [...lovet, ...delt];
  }, [kunder, deler, radgiver, planEndret, lastet]);

  const alle = [...ekstra, ...fraServer];
  const erUtsatt = (o: Oppgave) => (utsatt[o.id]?.til ?? "") > DAGENS_DATO;
  const synlige = alle.filter((o) => !erUtsatt(o));
  const utsatte = alle.filter(erUtsatt);

  function fullfor(o: Oppgave, beskrivelse: string, utfall: string, loggtekst: string) {
    setFerdig({ ...ferdig, [o.id]: beskrivelse });
    loggOppfolging(o.kundeId, radgiver, loggtekst, utfall);
    if (o.type === "oppfolging") {
      skrivLokal(`plan:${o.kundeId}`, null);
      setPlanEndret((n) => n + 1);
    }
  }

  function angre(id: string) {
    const ny = { ...ferdig };
    delete ny[id];
    setFerdig(ny);
  }

  function utsett(o: Oppgave, grunn: string, dager: number) {
    setUtsatt({ ...utsatt, [o.id]: { til: leggTilDager(DAGENS_DATO, dager), grunn } });
    loggOppfolging(o.kundeId, radgiver, `Varsel «${o.tittel}» utsatt ${dager} dager: ${grunn}.`, grunn === "Falsk alarm" ? "Falsk alarm" : "Varsel utsatt");
    setUtsetter(null);
  }

  function angreUtsettelse(id: string) {
    const ny = { ...utsatt };
    delete ny[id];
    setUtsatt(ny);
  }

  const uten = synlige.reduce((s, o) => s + o.minutterUten, 0);
  const med = synlige.reduce((s, o) => s + o.minutterMed, 0);
  const spart = synlige.filter((o) => ferdig[o.id]).reduce((s, o) => s + o.minutterUten - o.minutterMed, 0);
  const tid = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} t ${min % 60 ? `${min % 60} min` : ""}`.trim() : `${min} min`);

  return (
    <Kort
      overtittel={`${synlige.length} oppgaver i dag${utsatte.length ? ` · ${utsatte.length} utsatt` : ""}`}
      tittel="Dagens agenda"
      hoyre={
        <span className="flex items-center gap-3 text-right text-xs text-slate-500">
          {!lukket && (
            <span>
              Antatt forberedelse ca. <b className="text-teal-700">{tid(med)}</b> i stedet for ca. {tid(uten)} (anslag, ikke målt)
              {spart > 0 && <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 font-medium text-teal-800">Spart så langt: {tid(spart)}</span>}
            </span>
          )}
          <button
            onClick={() => setLukket(!lukket)}
            aria-expanded={!lukket}
            className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 font-semibold whitespace-nowrap text-slate-700 hover:border-slate-400"
          >
            {lukket ? "Vis agenda" : "Lukk"}
          </button>
        </span>
      }
    >
      {lukket ? (
        <p className="-mt-2 text-xs text-slate-500">
          Agendaen er lukket. {synlige.filter((o) => ferdig[o.id]).length} av {synlige.length} oppgaver er gjort i dag.
        </p>
      ) : (
        <>
          <ol className="space-y-2">
            {synlige.map((o, i) => {
              const gjort = ferdig[o.id];
              return (
                <li key={o.id} className={`rounded-lg border px-4 py-3 ${gjort ? "border-slate-100 bg-slate-50" : "border-slate-200"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className={`min-w-0 flex-1 ${gjort ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tall text-xs text-slate-400">{i + 1}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TYPE[o.type].stil}`}>{TYPE[o.type].tekst}</span>
                        <span className={`text-sm font-medium text-slate-900 ${gjort ? "line-through" : ""}`}>{o.tittel}</span>
                        <span className={`text-[11px] ${o.frist === "I dag" || o.frist.startsWith("Forfalt") ? "font-medium text-red-600" : "text-slate-500"}`}>{o.frist}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{o.grunn}</p>
                      {o.forslag && <p className="mt-0.5 text-xs font-medium text-teal-800">→ {o.forslag}</p>}
                    </div>
                    {gjort ? (
                      <span className="flex items-center gap-2 text-xs text-emerald-700">
                        ✓ {gjort}
                        <button onClick={() => angre(o.id)} className="text-slate-400 hover:underline">
                          angre
                        </button>
                      </span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-1.5 text-xs">
                        {(o.type === "ring" || o.type === "folgopp" || o.type === "oppfolging") && (
                          <Knapp primar onClick={() => fullfor(o, "Samtale logget", "Ringt kunden", `Ringte ${o.kontakt}. ${o.forslag ?? ""}`.trim())}>
                            Logg samtale
                          </Knapp>
                        )}
                        {o.melding && (
                          <Knapp primar={!["ring", "folgopp", "oppfolging"].includes(o.type)} onClick={() => setMelding({ oppgave: o, tekst: o.melding })}>
                            Send melding
                          </Knapp>
                        )}
                        <Knapp onClick={() => setBooker(booker === o.id ? null : o.id)}>Book møte</Knapp>
                        <Knapp onClick={() => setUtsetter(utsetter === o.id ? null : o.id)}>Utsett</Knapp>
                        <Link href={`/kunde/${o.kundeId}`} className="rounded-md px-2 py-1 font-semibold whitespace-nowrap text-snb-rod hover:underline">
                          Åpne →
                        </Link>
                      </span>
                    )}
                  </div>
                  {booker === o.id && !gjort && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-slate-500">Ledige tider:</span>
                      {ledigeTider().map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            fullfor(o, `Møte ${t}`, "Møte avtalt", `Møte med ${o.kontakt} booket ${t}.`);
                            setBooker(null);
                          }}
                          className="rounded-full border border-teal-600 px-2.5 py-0.5 text-teal-800 hover:bg-teal-50"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                  {utsetter === o.id && !gjort && <UtsettPanel onUtsett={(grunn, dager) => utsett(o, grunn, dager)} />}
                </li>
              );
            })}
          </ol>
          {utsatte.length > 0 && (
            <div className="mt-3 text-xs">
              <button onClick={() => setVisUtsatte((v) => !v)} className="font-semibold text-snb-rod hover:underline">
                {visUtsatte ? "Skjul utsatte varsler" : `Vis ${utsatte.length} utsatte varsler`}
              </button>
              {visUtsatte && (
                <ul className="mt-2 space-y-1 text-slate-600">
                  {utsatte.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{o.tittel}</span>
                      <span>
                        · {utsatt[o.id].grunn} · vises igjen {kortDato(utsatt[o.id].til)}
                      </span>
                      <button onClick={() => angreUtsettelse(o.id)} className="text-slate-400 hover:underline">
                        angre
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {melding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setMelding(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-sm font-semibold">Melding til {melding.oppgave.kontakt}</div>
            <div className="mb-3 text-xs text-slate-500">{melding.oppgave.kundenavn} · forhåndsutfylt, rediger fritt</div>
            <textarea
              value={melding.tekst}
              onChange={(e) => setMelding({ ...melding, tekst: e.target.value })}
              rows={9}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">Demo: meldingen sendes ikke, men logges på kunden.</span>
              <span className="flex gap-2">
                <Knapp onClick={() => setMelding(null)}>Avbryt</Knapp>
                <Knapp
                  primar
                  onClick={() => {
                    fullfor(melding.oppgave, "Melding sendt", "Melding sendt", `Melding sendt: «${melding.tekst.split("\n").filter(Boolean)[1] ?? melding.tekst}»`);
                    setMelding(null);
                  }}
                >
                  Send
                </Knapp>
              </span>
            </div>
          </div>
        </div>
      )}
    </Kort>
  );
}

// Utsett eller avvis et varsel med begrunnelse. «Falsk alarm» logges eget, så falske alarmer kan måles i en pilot.
function UtsettPanel({ onUtsett }: { onUtsett: (grunn: string, dager: number) => void }) {
  const [grunn, setGrunn] = useState(GRUNNER[0]);
  return (
    <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
      <div className="mb-1.5 font-medium text-slate-700">Hvorfor utsetter du varselet?</div>
      <div className="flex flex-wrap gap-1.5">
        {GRUNNER.map((g) => (
          <button
            key={g}
            onClick={() => setGrunn(g)}
            className={`rounded-full border px-2.5 py-0.5 ${grunn === g ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600"}`}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-slate-500">Vis igjen om</span>
        {[7, 14, 30].map((d) => (
          <Knapp key={d} onClick={() => onUtsett(grunn, d)}>
            {d} dager
          </Knapp>
        ))}
      </div>
    </div>
  );
}

function Knapp({ children, onClick, primar }: { children: React.ReactNode; onClick: () => void; primar?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-semibold ${primar ? "bg-snb-rod text-white hover:bg-snb-rod-mork" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
    >
      {children}
    </button>
  );
}
