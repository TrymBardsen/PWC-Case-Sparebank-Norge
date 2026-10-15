import { Kort } from "@/components/ui";

export default function Om() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Om Likviditetsradar</h1>
        <p className="mt-1 text-slate-600">
          Fra reaktiv til proaktiv: rådgiveren ser likviditetsskvisen uker før kunden ringer, forstår hvorfor, og har et konkret forslag klart når samtalen starter.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Steg nr={1} tittel="Oppdag" tekst="Prioriteringsliste med forklarbar score. Hver kunde viser hvilke signaler som trekker opp." />
        <Steg nr={2} tittel="Forstå" tekst="13-ukers prognose dag for dag, med kjente forfall (lønn, MVA, skatt, avdrag) og kundens egne fakturaer." />
        <Steg nr={3} tittel="Handle" tekst="Scenarioer, tiltak med effekt i kroner, og et AI-utkast til samtaleunderlag. Rådgiveren beslutter." />
      </div>

      <Kort tittel="Hvordan prognosen virker">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Normalnivå for inn- og utbetalinger fra siste 8 uker, sesongjustert per bransje.</li>
          <li>Kjente utbetalinger legges på eksakt dato: lønn (20.), forskuddstrekk og AGA (15. annenhver måned), MVA-terminer, husleie, strøm, renter og avdrag.</li>
          <li>Med samtykke til regnskapssystemet erstattes de første fire ukene av faktiske fakturaer, justert for hvor sent hver kunde pleier å betale.</li>
          <li>Restanser, forfalte terminer og forfalt leverandørgjeld trekkes ut tidlig i perioden.</li>
          <li>Usikkerhetsbåndet er dobbelt så bredt uten reskontro. Det viser kunden verdien av å dele data.</li>
          <li>Bevisst regelbasert, ikke en svart boks: hver krone kan spores til en post. Det gjør varselet forklarbart (EU AI Act) og lett å stole på.</li>
        </ul>
      </Kort>

      <Kort tittel="Datakilder">
        <table className="w-full text-sm">
          <tbody className="[&_td]:border-b [&_td]:border-slate-100 [&_td]:py-1.5">
            <Rad a="Enhetsregisteret, Regnskapsregisteret" b="Ekte, åpent API" c="Kundebilde, status, regnskap, roller" />
            <Rad a="Norges Bank (styringsrente)" b="Ekte, åpent API" c="Rentescenario, toppstripe" />
            <Rad a="Strømpris NO5 (hvakosterstrommen.no)" b="Ekte, åpent API" c="Strømscenario for energiintensive kunder" />
            <Rad a="Konto, kassekreditt, lån, avviste betalinger" b="Syntetisk (bankens egne data)" c="Prognose og score" />
            <Rad a="Reskontro, leverandørgjeld, restanser" b="Syntetisk (krever samtykke)" c="Prognose og score" />
            <Rad a="Betalingsanmerkninger, inkasso" b="Simulert tredjepart" c="Score" />
          </tbody>
        </table>
      </Kort>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Kort tittel="Regulatorisk kobling">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>IFRS 9: tidligere identifisering av vesentlig økt kredittrisiko (steg 2) gir mer presise tapsavsetninger.</li>
            <li>EBA-retningslinjer forventer systemer for tidligvarsling og konsistent håndtering av betalingslettelser.</li>
            <li>EU AI Act: forklarbare varsler, mennesket tar beslutningen, AI-tekst merkes som utkast.</li>
            <li>GDPR: tre samtykkenivåer, og eierens privatøkonomi krever eget samtykke.</li>
          </ul>
        </Kort>
        <Kort tittel="Fallgruver vi har designet for">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>Falske alarmer: sesongbedrifter (f.eks. hagesenteret) vurderes mot egen sesongprofil.</li>
            <li>Selvoppfyllende profeti: tiltakene handler om å hjelpe, ikke å kutte rammen.</li>
            <li>Glemte kunder: lang tid siden kontakt løfter kunden på listen.</li>
            <li>Smitte: underleverandører til en kunde i krise flagges automatisk.</li>
          </ul>
        </Kort>
      </div>

      <Kort tittel="Pilot og måling">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Test på historiske data: hvor mange av fjorårets mislighold ville blitt flagget, og hvor mange uker tidligere?</li>
          <li>Pilot i én region eller bransje (f.eks. bygg i Bergen) i tre måneder.</li>
          <li>KPI-er: uker fra første signal til kontakt, andel flaggede kunder som klarte seg, tap og avsetninger, rådgivertid per sak, falsk alarm-rate (logget utfall).</li>
        </ul>
      </Kort>
    </div>
  );
}

function Steg({ nr, tittel, tekst }: { nr: number; tittel: string; tekst: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-700 text-xs font-semibold text-white">{nr}</span>
        <span className="font-semibold">{tittel}</span>
      </div>
      <p className="text-sm text-slate-600">{tekst}</p>
    </div>
  );
}

function Rad({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <tr>
      <td className="pr-4 font-medium">{a}</td>
      <td className="pr-4 text-slate-600">{b}</td>
      <td className="text-slate-600">{c}</td>
    </tr>
  );
}
