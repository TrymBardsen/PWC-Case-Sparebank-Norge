import Link from "next/link";
import { notFound } from "next/navigation";
import { hentKunde, hentVurderinger, portefolje } from "@/lib/data";
import { hentMakro } from "@/lib/makro";
import { DAGENS_DATO, dagerMellom, dagerSiden, kortDato } from "@/lib/dato";
import { kr, mnok, prosent } from "@/lib/format";
import { KildeTag, Kort, SamtykkeMerke, ScoreMerke, Utnyttelse } from "@/components/ui";
import { KundePrognose } from "@/components/KundePrognose";
import { AiBrief } from "@/components/AiBrief";
import { Oppfolging } from "@/components/Oppfolging";
import { TekstSignaler } from "@/components/TekstSignaler";
import { alleTekster } from "@/lib/tekst";
import { ScoreForklaring } from "@/components/ScoreForklaring";

// Dynamisk, så lagrede tekstanalyser slår inn i scoren med en gang
export const dynamic = "force-dynamic";

export default async function Kundeside({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kunde = hentKunde(id);
  if (!kunde) notFound();

  const { vurderinger, smitte } = hentVurderinger();
  const v = vurderinger.get(kunde.id)!;
  const makro = await hentMakro();
  const faktorer = [...v.faktorer].sort((a, b) => b.poeng - a.poeng || Number(a.ukjent ?? 0) - Number(b.ukjent ?? 0));
  const navn = (kid: string) => portefolje.kunder.find((k) => k.id === kid)!.navn;
  const eksponerte = smitte.filter((s) => s.fra === kunde.id);
  const avhengigAv = smitte.filter((s) => s.til === kunde.id);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="overtittel mb-1">Kundeanalyse</div>
            <h1 className="font-overskrift text-3xl font-bold text-snb-rod">{kunde.navn}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
              Risikoscore <ScoreMerke score={v.score} niva={v.niva} stor />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {kunde.naceKode} · {kunde.ansatte} ansatte · etablert {kunde.etablert} · daglig leder {kunde.dagligLeder}
            </p>
            <p className="text-xs text-slate-500">
              Org.nr. {kunde.orgnr} (fiktivt) · {kunde.adresse} · {kunde.segment} · {kunde.eierstruktur.toLowerCase()} · kunde siden {kunde.kundeSiden} · risikoklasse{" "}
              {kunde.risikoklasse}
            </p>
            <p className="text-xs text-slate-500">
              Omsetning {kunde.regnskapIFjor.omsetning.map((o) => `${o.aar}: ${mnok(o.belop)}`).join(" · ")} · driftsresultat 2025 {mnok(kunde.regnskapIFjor.driftsresultat)} ·
              egenkapitalandel {prosent(kunde.regnskapIFjor.egenkapitalAndel)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm sm:grid-cols-4">
            <Info tittel="Kassekreditt" verdi={mnok(kunde.kassekredittRamme)}>
              <Utnyttelse andel={v.kkUtnyttelse} />
            </Info>
            <Info tittel="Lån" verdi={mnok(kunde.lan.reduce((s, l) => s + l.saldo, 0))} />
            <Info tittel="Sikkerheter" verdi={mnok(kunde.sikkerheter)} />
            <Info tittel="Siste kontakt" verdi={kunde.sisteKontakt ? `${dagerSiden(kunde.sisteKontakt)} dager` : "Ingen registrert"} />
            <div className="col-span-2 border-t border-slate-200 pt-3 sm:col-span-4">
              <Link
                href={`/kunde/${kunde.id}/rapport`}
                className="inline-flex items-center gap-2 rounded-md bg-snb-rod px-4 py-2 text-sm font-semibold text-white hover:bg-snb-rod-mork"
              >
                Lag møterapport med KI →
              </Link>
              <Link
                href={`/kunde/${kunde.id}/mote`}
                className="ml-2 inline-flex items-center gap-2 rounded-md border border-snb-rod px-4 py-2 text-sm font-semibold text-snb-rod hover:bg-snb-rod-lys"
              >
                Møtemodus
              </Link>
              <span className="mt-1 block text-xs text-slate-500">Møterapport før møtet · møtemodus viser prognose og tiltak til kunden, uten interne vurderinger</span>
            </div>
          </div>
        </div>
      </div>

      {kunde.sensitiv && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
          <div className="font-semibold">Sensitiv situasjon – vær varsom med kontakt</div>
          <p className="mt-0.5">{kunde.sensitiv}</p>
          <p className="mt-1 text-xs text-violet-800">
            Kunden er tatt ut av dagens agenda. Bruk tallene under som bakgrunn, men respekter det som er avtalt om kontakt.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <KundePrognose kunde={kunde} strompris={makro.stromNO5} />
          {kunde.fakturaer && kunde.fakturaer.length > 0 && (
            <Kort overtittel="Regnskapssystem" tittel="Utestående fakturaer" hoyre={<KildeTag kilde="Regnskapssystem" />}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-1.5">Kunde</th>
                    <th>Forfall</th>
                    <th className="text-right">Dager over forfall</th>
                    <th className="text-right">Beløp</th>
                  </tr>
                </thead>
                <tbody>
                  {[...kunde.fakturaer]
                    .sort((a, b) => a.forfall.localeCompare(b.forfall))
                    .map((f) => {
                      const over = dagerMellom(f.forfall, DAGENS_DATO);
                      return (
                        <tr key={f.id} className="tall border-b border-slate-100 last:border-0">
                          <td className="py-1.5">{f.debitor}</td>
                          <td>{kortDato(f.forfall)}</td>
                          <td className={`text-right ${over > 30 ? "font-semibold text-red-600" : over > 0 ? "text-orange-600" : "text-slate-400"}`}>{over > 0 ? over : "–"}</td>
                          <td className="text-right">{kr(f.belop)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </Kort>
          )}
          <TekstSignaler kundeId={kunde.id} kilder={alleTekster(kunde)} analyse={v.tekstanalyse} debitorer={kunde.debitorer} />
          <AiBrief kundeId={kunde.id} />
        </div>

        <div className="space-y-6">
          <Kort overtittel="Forklarbar AI" tittel="Signaler bak varselet" hoyre={<span className="tall text-xs text-slate-500">{v.score} av 100 poeng</span>}>
            <ScoreForklaring faktorer={v.faktorer} score={v.score} />
            <ul className="space-y-3">
              {faktorer.map((f) => (
                <li key={f.id} className={f.poeng === 0 && !f.ukjent ? "opacity-45" : ""}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{f.navn}</span>
                    <span className="tall text-xs text-slate-500">
                      {f.ukjent ? "?" : f.poeng}/{f.maks}
                    </span>
                  </div>
                  <div className="my-1 h-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${f.ukjent ? "bg-slate-300" : "bg-teal-600"}`} style={{ width: `${f.ukjent ? 100 : (f.poeng / f.maks) * 100}%`, opacity: f.ukjent ? 0.4 : 1 }} />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-slate-600">{f.forklaring}</span>
                    <KildeTag kilde={f.kilde} />
                  </div>
                </li>
              ))}
            </ul>
          </Kort>

          <Kort overtittel="Personvern" tittel="Datagrunnlag og samtykke" hoyre={<SamtykkeMerke niva={kunde.samtykke} />}>
            <ul className="space-y-2 text-sm">
              <Datanivå pa tittel="1 · Bankdata og offentlige data" tekst="Konto og transaksjoner, kassekreditt, lån, sikkerheter, avviste betalinger, registerhendelser og SSB." />
              <Datanivå
                pa={kunde.samtykke >= 2}
                tittel="2 · Regnskapssystem"
                tekst={kunde.samtykke >= 2 ? `Reskontro og forfalt leverandørgjeld fra ${kunde.regnskapssystem ?? "regnskapssystemet"}.` : "Uten reskontro er prognosen bredere og vi ser ikke hvem som skylder penger."}
              />
              <Datanivå pa={kunde.samtykke >= 3} tittel="3 · Eierens privatøkonomi" tekst="Finnes ikke i datagrunnlaget (krever eget samtykke)." />
            </ul>
            {kunde.samtykke < 2 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Tips: be om tilgang til regnskapssystemet. Usikkerheten i prognosen halveres, og kunden får factoring som mulig tiltak.
              </p>
            )}
          </Kort>

          {(eksponerte.length > 0 || avhengigAv.length > 0) && (
            <Kort overtittel="Verdikjede" tittel="Nettverk i porteføljen" hoyre={<KildeTag kilde="Bankdata" />}>
              <ul className="space-y-2 text-sm">
                {eksponerte.map((s) => (
                  <li key={s.til}>
                    <Link href={`/kunde/${s.til}`} className="font-semibold text-snb-rod hover:underline">
                      {navn(s.til)}
                    </Link>{" "}
                    får {prosent(s.andel)} av innbetalingene sine herfra. Rammes hvis {kunde.navn} sliter.
                  </li>
                ))}
                {avhengigAv.map((s) => (
                  <li key={s.fra}>
                    {prosent(s.andel)} av innbetalingene kommer fra{" "}
                    <Link href={`/kunde/${s.fra}`} className="font-semibold text-snb-rod hover:underline">
                      {navn(s.fra)}
                    </Link>
                    , som nå betaler i snitt {s.forsinkelse} dager etter forfall.
                  </li>
                ))}
              </ul>
            </Kort>
          )}

          <Kort overtittel="Betalere" tittel="Kundens kunder" hoyre={<KildeTag kilde="Bankdata" />}>
            <ul className="space-y-1.5 text-sm">
              {kunde.debitorer.map((d) => (
                <li key={d.navn} className="flex items-center justify-between gap-2">
                  <span>{d.navn}</span>
                  <span className="tall text-xs text-slate-500">
                    {prosent(d.andelAvInnbetalinger)} ·{" "}
                    {d.snittDagerForsinkelse === undefined ? (
                      <span>forsinkelse ukjent</span>
                    ) : (
                      <span className={d.snittDagerForsinkelse > 20 ? "font-medium text-red-600" : ""}>{d.snittDagerForsinkelse} d forsinket</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Kort>

          <Oppfolging kundeId={kunde.id} notater={kunde.notater} radgiver={portefolje.radgiver} />
        </div>
      </div>
    </div>
  );
}

function Info({ tittel, verdi, children }: { tittel: string; verdi: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">{tittel}</div>
      <div className="tall font-overskrift text-lg font-bold text-slate-900">{verdi}</div>
      {children}
    </div>
  );
}

function Datanivå({ pa, tittel, tekst }: { pa: boolean; tittel: string; tekst: string }) {
  return (
    <li className="flex gap-2">
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] text-white ${pa ? "bg-teal-600" : "bg-slate-300"}`}>{pa ? "✓" : ""}</span>
      <span>
        <span className={`block font-medium ${pa ? "text-slate-900" : "text-slate-500"}`}>{tittel}</span>
        <span className="block text-xs text-slate-500">{tekst}</span>
      </span>
    </li>
  );
}
