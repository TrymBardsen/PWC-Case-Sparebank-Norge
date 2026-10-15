# Likviditetsradar

**En AI-forsterket rådgiver for bedriftskunder med risiko for likviditetsskvis.**

Likviditetsradar er vårt svar på Sparebanken Norges case «Fremtidsbile 2027». Løsningen hjelper bedriftsrådgiveren med å oppdage likviditetsproblemer tidligere, forstå hva som driver dem og møte kunden med konkrete, gjennomtenkte alternativer.

Dette er en hackathon-prototype, ikke et produksjonssystem. Demoen bruker syntetiske bank- og kundedata, supplert med enkelte åpne data.

## Kundesituasjonen

En bedrift kan få betalingsproblemer selv om årsregnskapet ser greit ut. Store forfall, forsinkede innbetalinger, sesongsvingninger eller en viktig kunde som betaler sent kan skape en likviditetskrise før kunden selv ber banken om hjelp.

Beslutningen kunden og rådgiveren må ta, er **hva de bør gjøre nå for å komme gjennom de neste ukene uten at tiltakene gjør situasjonen verre**. Det kan for eksempel være å følge opp utestående fakturaer, avtale betalingsutsettelse, redusere kostnader eller vurdere finansiering.

## Hva løsningen tilfører

Generelle AI-verktøy kan forklare regnskapstall, foreslå spørsmål og lage planer. Likviditetsradar kobler denne hjelpen til bankens relasjon og kontekst:

- **Tidlig varsling:** Porteføljen rangeres etter en forklarbar risikoscore, slik at rådgiveren kan prioritere proaktiv kontakt.
- **Kundens likviditetsbilde:** En daglig 13-ukers prognose samler forventede innbetalinger, kjente forfall og usikkerhet. Ved tilgang til reskontro legges fakturaer og debitorenes betalingsmønster inn.
- **Forklaring, ikke bare en score:** Rådgiveren kan se hvilke signaler som påvirker vurderingen, hvilke poster som driver prognosen, og hvordan scenarioer påvirker den.
- **Tiltak som kan prøves ut:** Prognosen viser anslått effekt av mulige tiltak og en anbefalt pakke. Forutsetninger og forbehold må vurderes av rådgiveren og kunden.
- **Mennesket i kundefront:** AI kan lage et utkast til samtaleunderlag basert på beregnede fakta. Rådgiveren kontrollerer og tilpasser det; AI tar ikke beslutningen.
- **Lokal innsikt og nettverk:** Rådgiveren kan se avhengigheter mellom bedrifter i porteføljen og supplere bildet med åpne virksomhets- og makrodata.

Arbeidsflyten er **oppdag → forstå → handle**. Målet er ikke å erstatte rådgiveren, men å gi mer tid til dialog, skjønn og tillit – områder et generelt AI-verktøy ikke kan levere alene.

## Prototype og 2027-pilot

Prototypen viser én konkret kundesituasjon: likviditetsskvis hos en bedriftskunde. Den inneholder en portefølje med 14 fiktive Bergen-bedrifter, kundesider, prognoser, scenarioer, tiltak, porteføljeavhengigheter, virksomhetssøk og samtaleunderlag.

Et avgrenset forsøk i 2027 kan prøves ut med rådgivere i én region eller bransje, først i **skygge- eller beslutningsstøttemodus**. Rådgiveren vurderer varslene og dokumenterer om og hvorfor de er nyttige; løsningen kontakter ikke kunden eller fatter kredittbeslutninger automatisk.

Før en pilot med reelle kundedata bør banken blant annet:

1. Backteste prognoser og varsler på historiske data uten å bruke informasjon fra framtiden.
2. Kontrollere treffsikkerhet, falske alarmer, varslingstid og forskjeller mellom bransjer og kundegrupper.
3. Avklare behandlingsgrunnlag, samtykke, tilgangsstyring, dataminimering, lagring, logging og eventuell bruk av eksterne AI-leverandører.
4. La rådgivere og kunder prøve arbeidsflyten og evaluere om rådene oppleves relevante og tillitvekkende.

Mulige måltall er tid fra første signal til rådgiverkontakt, andel varslede kunder som unngår betalingsproblemer, falsk alarm-rate, tap/avsetninger og rådgivertid per sak. Måltall og terskler må fastsettes med banken før forsøket.

## Forutsetninger for det langsiktige konseptet

Den langsiktige visjonen bygger på hypoteser som må testes – ikke på at alle forutsetningene allerede er oppfylt:

- Banken kan, med riktig behandlingsgrunnlag og kundens medvirkning, koble kontantstrømmer med regnskap, reskontro og åpne data.
- Oppdaterte betalinger og fakturaer kan gi et mer handlingsrettet bilde enn periodiske regnskapstall alene.
- Rådgivere får verdi av forklarbare varsler og konkrete handlingsalternativer, ikke bare flere dashboards.
- Kunder vil dele relevante data når nytten er tydelig, de har kontroll over delingen, og rådgivningen oppleves som hjelp – ikke overvåking.
- AI kan effektivisere forberedelser, mens rådgiverens lokale markedskunnskap, relasjon og ansvar for skjønn fortsatt er avgjørende.

## Data og ansvarlig bruk

| Data | Bruk i prototypen | Kilde |
|---|---|---|
| Konto, saldo, lån, kassekreditt og avviste betalinger | Prognose og risikosignaler | Syntetiske bankdata |
| Fakturaer, leverandørgjeld og skatte-/MVA-restanser | Nærhorisont i prognosen og risikosignaler | Syntetiske data, modellert som samtykkebasert regnskapsdata |
| Bedriftsstatus og årsregnskap | Oppslag og kontekst | Brønnøysundregistrenes åpne API-er |
| Styringsrente og strømpris i NO5 | Makro- og scenarioinformasjon | Norges Bank og hvakosterstrommen.no |
| Betalingsanmerkninger og inkasso | Risikosignal | Simulert tredjepartsdata |
| Notater og kunderelasjoner | Samtalekontekst og porteføljeavhengighet | Syntetiske data |

Prototypen viser tre **konseptuelle** samtykkenivåer: bank/offentlige data, regnskapsdata og eierens privatøkonomi. Dette er ikke en implementert samtykke- eller tilgangskontroll.

**Ikke bruk ekte eller personidentifiserbare kundedata i denne demoen.** Kundene og bankdataene er syntetiske, men de åpne API-oppslagene bruker ekte offentlige data. Hvis `ANTHROPIC_API_KEY` er satt, sendes kundens samtalefakta – blant annet navn, rådgivernotater, debitorer og beregnede tall – fra serveren til Anthropic for å generere et utkast. Bruk bare syntetiske data med denne funksjonen. En produksjonsløsning krever egen sikkerhets-, personvern-, leverandør- og regulatorisk vurdering, samt dataminimering og passende tilgangskontroller.

## Kom i gang

Krever Node.js og npm.

```bash
npm install
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

### AI-samtaleunderlag (valgfritt)

Uten API-nøkkel brukes en regelbasert mal. For å prøve Claude:

1. Opprett API-tilgang hos [Anthropic Console](https://console.anthropic.com).
2. Kopier `.env.example` til `.env.local`, og sett `ANTHROPIC_API_KEY`.
3. Start utviklingsserveren på nytt.

API-nøkkelen brukes server-side. Husk at samtalefakta sendes til Anthropic når funksjonen brukes; se **Data og ansvarlig bruk**.

## Demo

En foreslått gjennomgang på omtrent fire minutter:

1. **Porteføljen:** Vis risikorangeringen, og hvorfor en kunde som ikke selv har tatt kontakt bør følges opp.
2. **Fjellsiden Bygg:** Åpne prognosen og vis når insolvensgrensen kan passeres, samt hvilke forfall som driver utviklingen.
3. **Scenario:** Simuler at en stor kunde betaler senere, og vis hvordan det påvirker likviditeten.
4. **Tiltak:** Sammenlign betalingslettelser og kostnadstiltak med den anbefalte pakken. Vis effekt og forbehold.
5. **Samtaleunderlag:** Generer eller åpne utkastet. Poengter at rådgiveren kontrollerer fakta og står for samtalen og beslutningen.
6. **Porteføljeeffekt og åpne data:** Vis hvordan en krise kan påvirke en annen bedrift, og prøv et oppslag i Enhetsregisteret.

Demoen bruker fast dato **15. oktober 2026** for syntetiske scenarioer. Makrodata og oppslag mot åpne registre kan være reelle og oppdateres uavhengig av demo-datoen.

## Datagenerering og kontroll

```bash
npm run data                 # Genererer data/portefolje.json
npm run sjekk                # Skriver ut score og prognose for alle kunder
npm run sjekk fjellsiden-bygg # Skriver ut resultat for én kunde
```

Kundeprofilene ligger i `scripts/generer-data.ts`. Demo-datoen settes i `src/lib/dato.ts`.

## Teknologi og struktur

Bygget med Next.js, React, TypeScript og Recharts. Prognosen og risikoscoren er regelbaserte og beregnes i applikasjonen; Claude brukes bare til å lage et strukturert samtaleutkast når API-nøkkel er konfigurert.

| Fil | Ansvar |
|---|---|
| `src/lib/prognose.ts` | Daglig 13-ukers prognose, usikkerhet og scenarioer |
| `src/lib/kalender.ts` | Kjente forfall for lønn, skatt/AGA, MVA, husleie, strøm og lån |
| `src/lib/tiltak.ts` | Tiltak, beregnet effekt og anbefalte tiltakspakker |
| `src/lib/score.ts` | Forklarbar prioriteringsscore og porteføljeavhengigheter |
| `src/lib/brief.ts` | Fakta til samtaleutkast, validering og regelbasert reserve |
| `src/lib/brreg.ts` | Oppslag mot Enhetsregisteret og Regnskapsregisteret |
| `scripts/generer-data.ts` | Syntetisk demoportefølje |
