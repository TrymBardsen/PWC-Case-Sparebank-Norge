import { Kort } from "@/components/ui";

export default function Om() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="overtittel mb-1">Slik fungerer det</div>
        <h1 className="font-overskrift text-3xl font-bold text-snb-rod">Om Likviditetsradaren</h1>
        <p className="mt-1 text-slate-600">
          Fra reaktiv til proaktiv: rådgiveren ser likviditetsskvisen uker før kunden ringer, forstår hvorfor, og har et konkret forslag klart når samtalen starter.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Steg nr={1} tittel="Oppdag" tekst="Dagens agenda og forklarbar score. AI leser notater, e-post og nyheter og finner signaler før tallene viser dem." />
        <Steg nr={2} tittel="Forstå" tekst="13-ukers prognose dag for dag, med kjente forfall (lønn, MVA, skatt, avdrag) og kundens egne fakturaer." />
        <Steg nr={3} tittel="Handle" tekst="Tiltak med effekt i kroner, meldingsutkast og samtaleunderlag. Rådgiveren beslutter." />
      </div>

      <Kort tittel="Hvordan prognosen virker">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Datagrunnlaget (per 1. oktober 2026) flyttes fram til dagens dato. Prognosen starter dagen etter siste kjente saldo og går 13 uker fram, dag for dag.</li>
          <li>Normal drift: samme uke i fjor, justert med veksten de siste 12 ukene mot de samme ukene året før. Med kortere historikk brukes kundens egen sesongprofil og et vektet nivå med dempet trend.</li>
          <li>Kjente utbetalinger legges på dato: lønn, forskuddstrekk og AGA, MVA (av faktisk omsetning i terminen, ellers samme anslag som prognosen), husleie, strøm, renter, avdrag og sluttbetalinger på lån.</li>
          <li>Med samtykke til regnskapssystemet brukes faktiske fakturaer de første fire ukene, justert for hvor sent hver kunde pleier å betale. Kontantsalg anslås da til 20 % av normalnivået.</li>
          <li>Usikkerheten måles fra kundens egen uke-til-uke-variasjon. Den gir et 80 %-intervall og sannsynligheten for å passere insolvensgrensen hver dag.</li>
          <li>Bevisst regelbasert, ikke en svart boks: hver krone kan spores til en post. Metoden er ikke testet mot faktiske utfall; det må gjøres før bruk på ekte kunder.</li>
          <li>Antakelser vises under «Dette vet vi ikke» på kundesiden, f.eks. lån som har passert sluttdato, sluttbetalinger og manglende reskontro.</li>
        </ul>
      </Kort>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Kort tittel="Insolvensgrensen">
          <p className="text-sm text-slate-700">
            Grensen settes der kassekreditten er brukt opp. Under den kan kunden ikke betale forpliktelser når de forfaller (illikviditet, jf. konkursloven § 61), og
            mislighold følger raskt. Grafen viser en rød sone under grensen, en varselsone over 90 % av rammen, datoen grensen passeres og sannsynligheten uke for uke.
          </p>
        </Kort>
        <Kort tittel="Tiltak mot mislighold">
          <p className="text-sm text-slate-700">
            Åtte tiltak regnes inn i prognosen: aktiv innfordring, betalingsavtale for MVA, avdragsfrihet, kostnadskutt, factoring, omgjøring av kassekreditt til lån,
            midlertidig ramme og kapitaltilskudd. Den anbefalte pakken velger de minst inngripende tiltakene til kunden holder en buffer over grensen og har under 20 %
            sannsynlighet for å passere den. Betalingslettelser merkes, så de kan rapporteres. Forslagene er beslutningsstøtte, ikke kredittbeslutninger.
          </p>
        </Kort>
      </div>

      <Kort tittel="Datakilder">
        <table className="w-full text-sm">
          <tbody className="[&_td]:border-b [&_td]:border-slate-100 [&_td]:py-1.5">
            <Rad a="Enhetsregisteret, Regnskapsregisteret" b="Ekte, åpent API" c="Kundebilde, status, regnskap, roller" />
            <Rad a="Norges Bank (styringsrente)" b="Ekte, åpent API" c="Hentes, men brukes ikke i beregningene (rentescenarioet er en manuell endring)" />
            <Rad a="Strømpris NO5 (hvakosterstrommen.no)" b="Ekte, åpent API" c="Strømscenario; merkes som reserveverdi når kilden ikke svarer" />
            <Rad a="Bedrifter, engasjement, kontakter og hendelser" b="Fiktiv kundebase (kundedata.json)" c="Kundebilde, score, tekstsignaler" />
            <Rad a="Saldo, transaksjoner, lån, sikkerheter, avviste betalinger" b="Syntetiske bankdata (tilleggsdata.json)" c="Prognose og score" />
            <Rad a="Reskontro og leverandørgjeld" b="Syntetisk, krever samtykke (tilleggsdata.json)" c="Prognose og score" />
            <Rad a="Konkurser per næring (Vestland og hele landet)" b="Ekte, SSB (tabell 10790 og 07091)" c="Bransjerisiko" />
          </tbody>
        </table>
      </Kort>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Kort tittel="Kundens egne AI-verktøy">
          <p className="text-sm text-slate-700">
            Kunden kan allerede be et generelt AI-verktøy forklare regnskapet, lage en kontantstrømplan fra eksporterte tall eller skrive et utkast til søknad om
            betalingsutsettelse. Det verktøyet ser bare det kunden selv laster opp, og kan ikke endre vilkår.
          </p>
        </Kort>
        <Kort tittel="Det banken og rådgiveren tilfører">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>Ser signalene før kunden spør, fordi betalinger, kassekreditt og lån allerede er i banken.</li>
            <li>Kan faktisk endre situasjonen: avdragsfrihet, ramme, refinansiering og factoring.</li>
            <li>Lokal kunnskap og relasjon: rådgiveren vurderer det tallene ikke viser, og tar ansvaret for rådet.</li>
          </ul>
        </Kort>
      </div>

      <Kort tittel="AI og databehandling">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Score, prognose og tiltak er regelbaserte og beregnes i appen. Ingen språkmodell endrer scoren automatisk.</li>
          <li>KI-møterapporten legger prompten i en kø på disk, og en Claude Code-økt i Claude Desktop svarer. Samtaleunderlag og tekstanalyse bruker Claude når en API-nøkkel er satt, ellers regelbasert mal.</li>
          <li>Prompten inneholder kundens navn, notater og tall. Data minimeres ikke, så bare fiktive demodata skal brukes.</li>
          <li>AI-tekst merkes som utkast, knyttes til beregnede fakta og må kontrolleres av rådgiveren.</li>
        </ul>
      </Kort>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Kort tittel="Regulatorisk kobling (hypoteser, ikke juridisk vurdert)">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>IFRS 9: tidligere identifisering av vesentlig økt kredittrisiko (steg 2) gir mer presise tapsavsetninger.</li>
            <li>EBA-retningslinjer forventer systemer for tidligvarsling og konsistent håndtering av betalingslettelser.</li>
            <li>EU AI Act: forklarbare varsler, mennesket tar beslutningen, AI-tekst merkes som utkast.</li>
            <li>GDPR: prototypen illustrerer tre samtykkenivåer. Det er ikke en implementert samtykke- eller tilgangskontroll.</li>
          </ul>
        </Kort>
        <Kort tittel="Fallgruver vi har designet for">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>Falske alarmer: prognosen bruker samme uker i fjor, så sesongbedrifter vurderes mot sitt eget mønster.</li>
            <li>Sensitive situasjoner: kunder der banken har lovet bare praktisk kontakt, tas ut av agendaen og får ingen salgsforslag.</li>
            <li>Selvoppfyllende profeti: tiltakene handler om å hjelpe, ikke å kutte rammen.</li>
            <li>Glemte kunder: lang tid siden kontakt løfter kunden på listen.</li>
            <li>Motpartsrisiko: kunder der en stor andel av innbetalingene kommer fra en motpart med betalingsanmerkning, flagges automatisk.</li>
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
        <span className="grid h-6 w-6 place-items-center rounded-full bg-snb-rod text-xs font-semibold text-white">{nr}</span>
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
