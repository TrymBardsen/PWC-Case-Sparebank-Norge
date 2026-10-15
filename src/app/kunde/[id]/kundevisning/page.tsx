import Link from "next/link";
import { notFound } from "next/navigation";
import { hentKunde } from "@/lib/data";
import { hentMakro } from "@/lib/makro";
import { DAGENS_DATO, langDato } from "@/lib/dato";
import { mnok, prosent } from "@/lib/format";
import { KundePrognose } from "@/components/KundePrognose";

// Kundevisning (startes med «Start kundemøte» under Forbered samtale): skjermen rådgiveren viser kunden. Bare kundens egne tall, prognose og tiltak.
// Ingen risikoscore, risikoklasse, tekstsignaler, notater eller andre kunder i banken.
export default async function Kundevisning({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kunde = hentKunde(id);
  if (!kunde) notFound();
  const makro = await hentMakro();
  const trekk = kunde.kassekredittTrekk[kunde.kassekredittTrekk.length - 1];

  return (
    <div className="space-y-6">
      {/* Skjuler rådgiverens navigasjon (faner, topp og bunn) så skjermen kan vises til kunden */}
      <style>{"[data-skjul-i-mote]{display:none}"}</style>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-[3px] border-snb-rod pb-5">
        <div className="flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sparebanken-norge-logo.png" alt="Sparebanken Norge" width={200} height={40} className="h-10 w-auto" />
          <span className="h-10 w-px bg-slate-200" />
          <div>
            <div className="overtittel">Likviditetsgjennomgang · {langDato(DAGENS_DATO)}</div>
            <h1 className="font-overskrift text-3xl font-bold text-snb-rod">{kunde.navn}</h1>
          </div>
        </div>
        <Link
          href={`/kunde/${kunde.id}?fane=samtale`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-snb-rod hover:text-snb-rod print:hidden"
        >
          Avslutt kundevisning
        </Link>
      </div>

      <p className="max-w-3xl text-[15px] text-slate-700">
        Prognosen viser forventet saldo på driftskontoen inkludert kassekreditten de neste 13 ukene. Den bygger på kontoen og betalingene deres i banken
        {kunde.samtykke >= 2 ? ` og reskontro fra ${kunde.regnskapssystem ?? "regnskapssystemet"}` : ""}: lønn, skatt, MVA, husleie og lån på forfallsdato, og
        inn- og utbetalinger fra samme periode i fjor. Vi kan prøve ulike tiltak sammen og se effekten med en gang.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Boks tittel="Kassekreditt" verdi={mnok(kunde.kassekredittRamme)} under={kunde.kassekredittRamme > 0 ? `${mnok(trekk)} brukt i dag (${prosent(trekk / kunde.kassekredittRamme)})` : "Ingen kassekreditt"} />
        <Boks tittel="Lån og leasing" verdi={mnok(kunde.lan.reduce((s, l) => s + l.saldo, 0))} under={kunde.lan.map((l) => l.navn).join(", ") || "Ingen lån"} />
        <Boks tittel="Saldo i dag" verdi={mnok(kunde.dagligSaldo[kunde.dagligSaldo.length - 1].saldo)} under="Driftskonto minus trekk på kassekreditt" />
      </div>

      <KundePrognose kunde={kunde} strompris={makro.stromNO5} mote />
    </div>
  );
}

function Boks({ tittel, verdi, under }: { tittel: string; verdi: string; under: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
      <div className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">{tittel}</div>
      <div className="tall font-overskrift text-2xl font-bold text-slate-900">{verdi}</div>
      <div className="text-xs text-slate-600">{under}</div>
    </div>
  );
}
