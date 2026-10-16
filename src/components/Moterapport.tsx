"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { kontroller, lesSvar, RapportSchema, type Katalogkilde, type Rapport, type Sitatstatus } from "@/lib/rapport";
import { Kort } from "./ui";

type Punkt = { tekst: string; kilder: { id: string; sitat: string }[] };

// Sjekker at et lagret svar fortsatt passer skjemaet og dagens kildekatalog (sitater og tall)
function stemmer(tekst: string, katalog: Katalogkilde[]): boolean {
  try {
    const r = RapportSchema.safeParse(lesSvar(tekst));
    if (!r.success) return false;
    const k = kontroller(r.data, katalog, {});
    return !k.tallUtenKilde.length && !k.sitater.some((s) => s.status === "ikke funnet" || s.status === "ukjent kilde");
  } catch {
    return false;
  }
}

// Valideringsfeil på norsk
z.config(z.locales.no());

export function Moterapport({
  kundeId,
  kundenavn,
  dato,
  prompt,
  katalog,
  lagret,
}: {
  kundeId: string;
  kundenavn: string;
  dato: string;
  prompt: string;
  katalog: Katalogkilde[];
  lagret?: { tekst: string; laget: string } | null; // ferdig forberedt rapport (data/rapporter), kontrollert på serveren
}) {
  const [forberedt, setForberedt] = useState<string | null>(null);
  const nokkel = `moterapport:${kundeId}`;
  const [svar, setSvar] = useState("");
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [feil, setFeil] = useState<string[]>([]);
  const [webStatus, setWebStatus] = useState<Record<string, Sitatstatus>>({});
  const [kopiert, setKopiert] = useState(false);
  const [visPrompt, setVisPrompt] = useState(false);
  const [jobb, setJobb] = useState<{ id: string; start: number; steg: 0 | 1 | 2 } | null>(null);
  const [sekunder, setSekunder] = useState(0);
  const [jobbFeil, setJobbFeil] = useState<string | null>(null);

  const valider = useCallback(
    async (tekst: string) => {
      setFeil([]);
      setRapport(null);
      setWebStatus({});
      let data: unknown;
      try {
        data = lesSvar(tekst);
      } catch {
        setFeil(["Svaret er ikke gyldig JSON. Kopier hele svaret fra Claude, uten tekst før eller etter."]);
        return;
      }
      const tolket = RapportSchema.safeParse(data);
      if (!tolket.success) {
        setFeil(tolket.error.issues.map((i) => `${i.path.join(".") || "(rot)"}: ${i.message}`));
        return;
      }
      if (tolket.data.kundeId !== kundeId) {
        setFeil([`Rapporten gjelder ${tolket.data.kundeId}, men denne siden er for ${kundeId}.`]);
        return;
      }
      setRapport(tolket.data);
      try {
        localStorage.setItem(nokkel, tekst);
      } catch {
        // Ikke kritisk
      }
      if (tolket.data.webkilder.length) {
        const res = await fetch("/api/verifiser-web", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kilder: tolket.data.webkilder.map((w) => ({ id: w.id, url: w.url, sitat: w.sitat })) }),
        });
        if (res.ok) setWebStatus(((await res.json()) as { status: Record<string, Sitatstatus> }).status);
      }
    },
    [kundeId, nokkel],
  );

  useEffect(() => {
    try {
      // En rapport lagret i nettleseren brukes bare hvis den fortsatt stemmer med dagens kildekatalog
      const lokal = localStorage.getItem(nokkel);
      if (lokal && stemmer(lokal, katalog)) {
        setSvar(lokal);
        void valider(lokal);
      } else if (lagret) {
        // Ferdig forberedt rapport: vises med en gang, uten å vente på køen
        setSvar(lagret.tekst);
        setForberedt(lagret.laget);
        void valider(lagret.tekst);
      }
    } catch {
      // Ikke kritisk
    }
  }, [nokkel, valider, lagret, katalog]);

  // «API-kall»: legger forespørselen i køen og venter på svar fra Claude
  async function generer() {
    setJobbFeil(null);
    setFeil([]);
    const res = await fetch("/api/rapport/generer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kundeId }) });
    if (!res.ok) {
      setJobbFeil("Kunne ikke starte genereringen.");
      return;
    }
    const { jobbId } = (await res.json()) as { jobbId: string };
    setJobb({ id: jobbId, start: Date.now(), steg: 1 });
  }

  useEffect(() => {
    if (!jobb || jobb.steg !== 1) return;
    const t = setInterval(async () => {
      setSekunder(Math.round((Date.now() - jobb.start) / 1000));
      const res = await fetch(`/api/rapport/status?jobb=${encodeURIComponent(jobb.id)}`, { cache: "no-store" });
      if (!res.ok) return;
      const s = (await res.json()) as { status: string; svar?: string };
      if (s.status === "ferdig" && s.svar) {
        clearInterval(t);
        setJobb({ ...jobb, steg: 2 });
        setSvar(s.svar);
        await valider(s.svar);
        setJobb(null);
      } else if (Date.now() - jobb.start > 8 * 60_000) {
        clearInterval(t);
        setJobb(null);
        setJobbFeil("Fikk ikke svar innen 8 minutter. Er Claude-økten som behandler køen åpen? Du kan også kjøre manuelt under.");
      }
    }, 2000);
    return () => clearInterval(t);
  }, [jobb, valider]);

  async function kopier() {
    await navigator.clipboard.writeText(prompt);
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2500);
  }

  function nullstill() {
    setForberedt(null);
    setRapport(null);
    setSvar("");
    setFeil([]);
    try {
      localStorage.removeItem(nokkel);
    } catch {
      // Ikke kritisk
    }
  }

  const kontroll = useMemo(() => (rapport ? kontroller(rapport, katalog, webStatus) : null), [rapport, katalog, webStatus]);

  // Nummerering av kilder i den rekkefølgen de brukes
  const kildenr = useMemo(() => {
    const m = new Map<string, number>();
    if (!rapport) return m;
    const alle = [...rapport.situasjon, ...rapport.risikoer, ...rapport.bransjeOgMarked, ...rapport.muligheter, ...rapport.anbefaltTiltak];
    for (const p of alle) for (const k of p.kilder) if (!m.has(k.id)) m.set(k.id, m.size + 1);
    return m;
  }, [rapport]);

  const statusFor = (sti: string, id: string) => kontroll?.sitater.find((s) => s.sti === sti && s.id === id)?.status ?? "venter";

  return (
    <div className="space-y-6">
      {!rapport && (
        <Kort overtittel="KI-generering" tittel="Generer møterapport" className="print:hidden">
          {!jobb ? (
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={generer} className="rounded-md bg-snb-rod px-6 py-3 text-sm font-semibold text-white hover:bg-snb-rod-mork">
                Generer møterapport →
              </button>
              <span className="text-sm text-slate-600">
                Claude leser {katalog.length} kilder fra bankens data, søker etter nyheter om bransjen og lager en rapport på én side med kildehenvisninger.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <Fremdrift aktiv={jobb.steg} sekunder={sekunder} />
              <p className="text-xs text-slate-500">Dette tar vanligvis 1–3 minutter, siden Claude også søker etter nyheter på nettet.</p>
            </div>
          )}
          {jobbFeil && <p className="mt-3 text-sm text-red-700">{jobbFeil}</p>}
          {feil.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-200 bg-snb-rod-lys p-3 text-xs text-red-800">
              <div className="mb-1 font-semibold">Svaret fulgte ikke skjemaet ({feil.length} feil). Prøv å generere på nytt.</div>
              <ul className="list-disc space-y-0.5 pl-4">
                {feil.slice(0, 8).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </Kort>
      )}

      {!rapport && !jobb && (
        <details className="print:hidden">
          <summary className="cursor-pointer text-sm font-semibold text-snb-rod">Kjør manuelt i Claude Desktop i stedet</summary>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Kort overtittel="Steg 1" tittel="Kjør prompten i Claude Desktop">
            <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Kopier prompten. Den inneholder kildekatalogen ({katalog.length} kilder) og JSON-skjemaet svaret må følge.</li>
              <li>Åpne Claude Desktop, slå på websøk og lim inn prompten.</li>
              <li>Kopier hele svaret (bare JSON) og lim det inn til høyre.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={kopier} className="rounded-md bg-snb-rod px-5 py-2.5 text-sm font-semibold text-white hover:bg-snb-rod-mork">
                {kopiert ? "Kopiert ✓" : "Kopier prompt"}
              </button>
              <button onClick={() => setVisPrompt((v) => !v)} className="text-sm font-semibold text-snb-rod hover:underline">
                {visPrompt ? "Skjul prompt" : "Vis prompt"}
              </button>
            </div>
            {visPrompt && <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-snb-gra p-3 text-[11px] whitespace-pre-wrap text-slate-700">{prompt}</pre>}
            <p className="mt-4 text-xs text-slate-500">
              Ingen API-nøkkel trengs. Ingenting sendes fra appen; du bestemmer selv hva som limes inn i Claude Desktop. Bruk bare fiktive data.
            </p>
          </Kort>

          <Kort overtittel="Steg 2" tittel="Lim inn svaret">
            <textarea
              value={svar}
              onChange={(e) => setSvar(e.target.value)}
              rows={12}
              placeholder='{"kundeId": "…", "sammendrag": "…", …}'
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-snb-gronn"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => valider(svar)}
                disabled={!svar.trim()}
                className="rounded-md bg-snb-gronn px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
              >
                Valider og vis rapport
              </button>
              <span className="text-xs text-slate-500">Valideres med Zod, og hver kilde kontrolleres.</span>
            </div>
            {feil.length > 0 && (
              <div className="mt-3 rounded-lg border border-red-200 bg-snb-rod-lys p-3 text-xs text-red-800">
                <div className="mb-1 font-semibold">Svaret følger ikke skjemaet ({feil.length} feil). Be Claude rette det, eller kjør prompten på nytt:</div>
                <ul className="list-disc space-y-0.5 pl-4">
                  {feil.slice(0, 12).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </Kort>
        </div>
        </details>
      )}

      {rapport && kontroll && (
        <>
          {forberedt && (
            <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-900 print:hidden">
              Ferdig forberedt rapport, laget {forberedt}. Sitater og tall er kontrollert mot dagens kildekatalog. Trykk «Ny rapport» for å lage en ny med Claude.
            </p>
          )}
          <Kontrollpanel rapport={rapport} kontroll={kontroll} webStatus={webStatus} onNy={nullstill} />

          <article className="mx-auto max-w-[210mm] rounded-lg border border-slate-200 bg-white p-8 text-[13px] leading-snug text-slate-800 print:max-w-none print:border-0 print:p-0 print:text-[11px]">
            <header className="mb-4 flex items-start justify-between gap-4 border-b-[3px] border-snb-rod pb-3">
              <div>
                <div className="overtittel">Møterapport · før kundemøtet</div>
                <h2 className="font-overskrift text-2xl font-bold text-snb-rod">{kundenavn}</h2>
              </div>
              <div className="text-right text-xs text-slate-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sparebanken-norge-logo.png" alt="Sparebanken Norge" className="ml-auto h-6 w-auto" />
                <div className="mt-1">{dato}</div>
                <div>KI-utkast kontrollert mot kilder</div>
              </div>
            </header>

            <div className="mb-4 rounded-lg border-l-4 border-snb-gronn bg-snb-gronn-lys px-4 py-2.5">{rapport.sammendrag}</div>

            {rapport.varsomhet && (
              <div className="mb-4 rounded-lg border border-teal-200 bg-white px-4 py-2 text-snb-gronn">
                <b>Varsomhet:</b> {rapport.varsomhet}
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Seksjon tittel="Situasjonen nå" punkter={rapport.situasjon} sti="situasjon" kildenr={kildenr} statusFor={statusFor} />
              <Seksjon
                tittel="Risikoer"
                punkter={rapport.risikoer}
                sti="risikoer"
                kildenr={kildenr}
                statusFor={statusFor}
                prefiks={(i) => <AlvorPille alvor={rapport.risikoer[i].alvor} />}
              />
              <Seksjon tittel="Bransje og marked" punkter={rapport.bransjeOgMarked} sti="bransjeOgMarked" kildenr={kildenr} statusFor={statusFor} />
              <Seksjon
                tittel="Anbefalte tiltak"
                punkter={rapport.anbefaltTiltak}
                sti="anbefaltTiltak"
                kildenr={kildenr}
                statusFor={statusFor}
                prefiks={(i) => <b className="text-slate-900">{rapport.anbefaltTiltak[i].tiltak}: </b>}
              />
              {rapport.muligheter.length > 0 && <Seksjon tittel="Muligheter" punkter={rapport.muligheter} sti="muligheter" kildenr={kildenr} statusFor={statusFor} />}
              <div>
                <h3 className="mb-1.5 font-overskrift text-sm font-bold text-snb-rod">Spørsmål å stille</h3>
                <ol className="list-decimal space-y-1 pl-4">
                  {rapport.sporsmal.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            </div>

            {rapport.ikkeKjent.length > 0 && (
              <div className="mt-4 text-xs text-slate-600">
                <b>Ikke kjent fra kildene:</b> {rapport.ikkeKjent.join(" · ")}
              </div>
            )}

            <footer className="mt-5 border-t border-slate-200 pt-3">
              <h3 className="mb-1 font-overskrift text-xs font-bold text-snb-rod">Kilder</h3>
              <ol className="grid grid-cols-1 gap-x-6 gap-y-0.5 text-[11px] text-slate-600 sm:grid-cols-2">
                {[...kildenr.entries()].map(([id, nr]) => {
                  const kat = katalog.find((k) => k.id === id);
                  const web = rapport.webkilder.find((w) => w.id === id);
                  return (
                    <li key={id}>
                      [{nr}]{" "}
                      {kat ? (
                        <>
                          {kat.tittel} <span className="text-slate-400">({kat.type}{kat.dato ? `, ${kat.dato}` : ""})</span>
                        </>
                      ) : web ? (
                        <>
                          <a href={web.url} target="_blank" rel="noreferrer" className="text-snb-rod hover:underline">
                            {web.tittel}
                          </a>{" "}
                          <span className="text-slate-400">
                            ({web.utgiver}, {web.publisert}) {webStatus[web.id] === "verifisert" ? "✓" : webStatus[web.id] ? "⚠" : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-red-700">{id} – ukjent kilde</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[10px] text-slate-400">
                KI-generert utkast. Hvert punkt viser til kilder; sitater er kontrollert mot bankens data og nettkildene. Rådgiveren vurderer og beslutter.
              </p>
            </footer>
          </article>
        </>
      )}
    </div>
  );
}

function Seksjon({
  tittel,
  punkter,
  sti,
  kildenr,
  statusFor,
  prefiks,
}: {
  tittel: string;
  punkter: Punkt[];
  sti: string;
  kildenr: Map<string, number>;
  statusFor: (sti: string, id: string) => Sitatstatus;
  prefiks?: (i: number) => React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-1.5 font-overskrift text-sm font-bold text-snb-rod">{tittel}</h3>
      <ul className="space-y-1.5">
        {punkter.map((p, i) => {
          const statuser = p.kilder.map((k) => statusFor(`${sti}[${i}]`, k.id));
          const gyldig = statuser.some((s) => s === "verifisert" || s === "venter");
          return (
            <li key={i} className={gyldig ? "" : "text-slate-400 line-through"} title={gyldig ? undefined : "Ingen gyldig kilde – ikke bruk dette punktet"}>
              {prefiks?.(i)}
              {p.tekst}
              {p.kilder.map((k, j) => (
                <sup
                  key={k.id + j}
                  title={`«${k.sitat}» – ${statuser[j]}`}
                  className={`ml-0.5 font-semibold ${statuser[j] === "verifisert" ? "text-snb-gronn" : statuser[j] === "venter" ? "text-slate-400" : "text-snb-rod"}`}
                >
                  [{kildenr.get(k.id)}]
                </sup>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AlvorPille({ alvor }: { alvor: "høy" | "middels" | "lav" }) {
  const stil = alvor === "høy" ? "bg-snb-rod text-white" : alvor === "middels" ? "bg-snb-rod-lys text-snb-rod" : "bg-snb-gronn-lys text-snb-gronn";
  return <span className={`mr-1 rounded-full px-1.5 py-px text-[10px] font-semibold ${stil}`}>{alvor}</span>;
}

function Kontrollpanel({
  rapport,
  kontroll,
  webStatus,
  onNy,
}: {
  rapport: Rapport;
  kontroll: ReturnType<typeof kontroller>;
  webStatus: Record<string, Sitatstatus>;
  onNy: () => void;
}) {
  const ok = kontroll.sitater.filter((s) => s.status === "verifisert").length;
  const avvist = kontroll.sitater.filter((s) => s.status === "ikke funnet" || s.status === "ukjent kilde");
  const webOk = rapport.webkilder.filter((w) => webStatus[w.id] === "verifisert").length;
  const webVenter = rapport.webkilder.filter((w) => !webStatus[w.id]).length;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm print:hidden">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="font-semibold text-snb-gronn">✓ Skjema godkjent (Zod)</span>
        <span className={avvist.length ? "font-semibold text-snb-rod" : "text-slate-700"}>
          {ok} av {kontroll.sitater.length} sitater verifisert
        </span>
        <span className="text-slate-700">
          Nettkilder: {webOk} av {rapport.webkilder.length} verifisert{webVenter ? ` (${webVenter} sjekkes …)` : ""}
        </span>
        <span className={kontroll.tallUtenKilde.length ? "font-semibold text-red-700" : "text-slate-700"}>{kontroll.tallUtenKilde.length} tall uten kilde</span>
        <span className="ml-auto flex gap-3">
          <button onClick={() => window.print()} className="rounded-md bg-snb-rod px-4 py-2 text-sm font-semibold text-white hover:bg-snb-rod-mork">
            Skriv ut / lagre PDF
          </button>
          <button onClick={onNy} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400">
            Ny rapport
          </button>
        </span>
      </div>
      {(avvist.length > 0 || kontroll.tallUtenKilde.length > 0) && (
        <ul className="mt-3 space-y-0.5 text-xs text-red-800">
          {avvist.map((s, i) => (
            <li key={`a${i}`}>
              {s.sti}: kilde {s.id} – {s.status === "ukjent kilde" ? "finnes ikke i katalogen" : `sitatet «${s.sitat}» står ikke ordrett i kilden`}
            </li>
          ))}
          {kontroll.tallUtenKilde.map((t, i) => (
            <li key={`t${i}`}>
              {t.sti}: tallet «{t.tall}» finnes ikke i de siterte kildene
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fremdrift({ aktiv, sekunder }: { aktiv: 0 | 1 | 2; sekunder: number }) {
  const steg = ["Forespørsel sendt til Claude", "Claude analyserer kildene og søker etter nyheter", "Validerer svaret (Zod) og kontrollerer kilder"];
  const naa = aktiv === 1 && sekunder < 3 ? 0 : aktiv;
  return (
    <ol className="space-y-2 text-sm">
      {steg.map((t, i) => (
        <li key={t} className="flex items-center gap-3">
          <span
            className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
              i < naa ? "bg-snb-gronn text-white" : i === naa ? "animate-pulse bg-snb-rod text-white" : "bg-slate-200 text-slate-500"
            }`}
          >
            {i < naa ? "✓" : i + 1}
          </span>
          <span className={i === naa ? "font-semibold text-slate-900" : i < naa ? "text-slate-600" : "text-slate-400"}>
            {t}
            {i === naa && i === 1 ? ` … ${sekunder} s` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
