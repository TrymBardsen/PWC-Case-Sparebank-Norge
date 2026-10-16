# Likviditetsradar

**Beslutningsstøtte for bedriftsrådgivere når en kunde er på vei inn i en likviditetsskvis.**

Likviditetsradar er vårt svar på Sparebanken Norges hackathon-case «Fremtidsbile 2027»: hvordan AI kan gjøre bedriftsrådgiveren til en AI-forsterket superhelt, mens banken beholder ekte mennesker i kundefront.

Dette er en **hackathon-prototype**, ikke et produksjonssystem. Kundene og bankdataene er fiktive og syntetiske. Enkelte åpne, offentlige data er ekte. Prototypen fatter ingen kredittbeslutninger og kontakter ikke kunder.

## Kundesituasjonen og kundens beslutning

En bedrift kan få betalingsproblemer selv om årsregnskapet ser greit ut. Store forfall (MVA, skattetrekk, lønn), forsinkede innbetalinger, sesongsvingninger eller en viktig kunde som betaler sent kan gjøre kassekreditten for liten før kunden selv ber banken om hjelp.

Beslutningen kunden må ta – sammen med rådgiveren – er **hva de bør gjøre nå for å komme gjennom de neste ukene uten at tiltakene gjør situasjonen verre**: følge opp utestående fakturaer, søke betalingsavtale, kutte kostnader, be om avdragsfrihet eller refinansiering, eller hente inn egenkapital.

Rådgiveren trenger å vite:

1. **Hva er problemet?** Når strekker likviditeten ikke til, og hvor sannsynlig er det?
2. **Hvilke data og signaler underbygger det?** Hver poengsum og hver krone i prognosen kan spores til en kilde.
3. **Hva vet vi ikke?** Manglende samtykke, antakelser om lån og restanser, og at metoden ikke er testet mot faktiske utfall.
4. **Hva kan kunden gjøre?** Tiltak med beregnet effekt i kroner og forbehold.
5. **Hva bør rådgiveren undersøke i samtalen?** Spørsmål og et utkast til samtaleunderlag.

## Kundens egne AI-verktøy – og hva banken tilfører

**Det kunden kan gjøre selv i 2027:** Et generelt AI-verktøy (ChatGPT, Copilot, Claude o.l.) kan allerede forklare et regnskap, lage en kontantstrømplan fra eksporterte tall, foreslå kostnadskutt og skrive utkast til søknad om betalingsutsettelse hos Skatteetaten. Mange kunder vil gjøre dette før de snakker med banken.

**Det banken og rådgiveren tilfører utover dette:**

- **Tidlig varsling uten at kunden må spørre.** Banken ser betalingene, kassekreditten, lånene og avviste betalinger fortløpende. Varselet kan komme uker før kunden selv ser problemet.
- **Mulighet til å endre situasjonen.** Bare banken kan innvilge avdragsfrihet, økt ramme, refinansiering eller factoring. Prototypen regner effekten av disse sammen med kundens egne tiltak.
- **Porteføljeblikk og lokal kunnskap.** Rådgiveren kjenner bransjen og regionen, og banken ser motparter med betalingsanmerkning (f.eks. at 62 % av innbetalingene kommer fra én motpart).
- **Ansvar, skjønn og relasjon.** Rådgiveren vurderer det tallene ikke viser, tar hensyn til sensitive situasjoner og står ansvarlig for rådet. AI-tekst er bare et utkast.

## Hva prototypen gjør

Arbeidsflyten er **oppdag → forstå → handle**.

| Funksjon | Hva den gjør | Status |
|---|---|---|
| Portefølje og agenda | 120 fiktive bedrifter fordelt på tre rådgivere. Velg rådgiver i toppen (Hanne er standard). Agendaen gir neste beste handling per kunde, varsler kan utsettes med begrunnelse (falske alarmer logges), og lovede oppfølginger og kunder delt av kolleger dukker opp. Porteføljetabellen viser «Følg med» og over som standard, med filter for nivå, bransje og kontakt og egne lagrede lister. «Hva er nytt» og muligheter er sammenfoldet. Tidsbesparelsen er **antatte** minutter, ikke målt. | Fungerer på syntetiske data |
| Forklarbar score | 15 regelbaserte signaler (prognose, overtrekk, forfalte terminer, restanser, avviste betalinger, motpart, bransje, tekstsignaler m.m.), hver med poeng, forklaring og kilde. | Fungerer, ikke kalibrert mot utfall |
| 13-ukers prognose | Daglig likviditet med 80 %-intervall, sannsynlighet for å passere insolvensgrensen og postene som driver utviklingen. | Fungerer, ikke backtestet |
| Scenarioer og tiltak | Fire scenarioer og åtte tiltak med justerbare tall, beregnet effekt i kroner og en anbefalt tiltakspakke. Betalingslettelser merkes. | Fungerer |
| «Dette vet vi ikke» | Kundesiden lister manglende data og antakelser (reskontro, utløpte lån, sluttbetalinger, restskatt, metode). | Fungerer |
| Kundevisning | Skjermen kunden ser i møtet: status i vanlig språk, én graf med og uten tiltak, de største utbetalingene som kommer, bare tiltakene rådgiveren har valgt under «Tiltak» (bankens tiltak merket «må vurderes av banken»), høyst to scenarioer og en handlingsplan som kan skrives ut, kopieres som e-post eller lagres i kundeloggen. Tilpasset nettbrett. | Fungerer |
| Kundeside | Kompakt topp, «Siden sist» (endringer siden forrige besøk), og fanene Oversikt (konklusjon, neste beste handling med ansvarlig og frist, tre drivere, spørsmål til kunden), Tiltak (anbefalt pakke øverst, valg av tiltak til kundemøtet, resten sammenfoldet), Samtale (forberedelse, samtaleunderlag med referat, oppfølging med påminnelse) og Detaljer (alle scoresignaler, datagrunnlag, fakturaer, kredittsaker). | Fungerer |
| Samtaleunderlag | Utkast med observasjoner, spørsmål, tiltak og åpning. Lages av en Claude Code-økt i Claude Desktop via samme kø som møterapporten. «Bruk regelbasert mal» gir et underlag uten AI. | Demo-oppsett, regelbasert reserve |
| Saksflyt (demo) | «Send til kredittvurdering» (forhåndsutfylt sak), «Be om tilgang til regnskapsdata», «Del med kollega», påminnelser, utsatte varsler, møtereferat og handlingsplan. **Lagres bare i nettleseren** – ingen ekte saksflyt, CRM eller varsling. | Demo |
| Tekstsignaler | Signaler i møtenotater, CRM og registerhendelser, hvert med ordrett sitat som kontrolleres mot kilden. | Ordliste som standard, valgfri Claude |
| KI-møterapport | Rapport med kildehenvisninger. Prompten legges i en kø på disk, og en Claude Code-økt i Claude Desktop svarer («rapportbroen»). | Demo-oppsett, se under |
| Virksomhetssøk | Oppslag i Enhetsregisteret og Regnskapsregisteret med enkle varselsignaler. | Ekte, åpne data |
| Muligheter | Grunner til positiv kontakt (ny kontrakt, vekst, ledig likviditet). Aldri for kunder i krise eller sensitiv situasjon. | Fungerer på syntetiske data |
| Sensitive situasjoner | Kunder der banken har lovet bare praktisk kontakt, tas ut av agendaen og får ingen tiltak eller salg i den regelbaserte malen. | Fungerer |

**Ikke implementert** (bare illustrert): ekte saksflyt, CRM og deling mellom brukere (demofunksjonene lagres i nettleseren), samtykkestyring og tilgangskontroll, innlogging, logging/revisjonsspor, ekte integrasjon mot kjernebank eller regnskapssystem, grønn omstilling (ingen energidata i grunnlaget) og eierens privatøkonomi.

## Hva kan prøves ut i 2027

Et avgrenset forsøk med rådgivere i én region eller bransje, først i **skyggemodus**: varslene vises for rådgiveren, men ingen kunde kontaktes eller vurderes automatisk. Rådgiveren registrerer om varselet var nyttig og hva som ble gjort.

Før forsøket bør banken:

1. Backteste prognose og score på historiske data, uten informasjon fra framtiden.
2. Måle treffsikkerhet, falske alarmer, varslingstid og forskjeller mellom bransjer og kundegrupper.
3. Avklare behandlingsgrunnlag, samtykke, tilgangsstyring, dataminimering, lagring, logging og eventuell bruk av AI-leverandører (DPIA).
4. La rådgivere og kunder prøve arbeidsflyten og vurdere om rådene oppleves relevante og tillitvekkende.

Mulige måltall: tid fra første signal til rådgiverkontakt, andel varslede kunder som unngår mislighold, falsk alarm-rate, tap og avsetninger, og rådgivertid per sak. Terskler fastsettes med banken.

## Langsiktige antakelser som må testes

**Teknologi**

- Regelbaserte prognoser er gode nok til å varsle i tide, eller kan forbedres med statistiske modeller uten å miste forklarbarheten.
- Språkmodeller (helst lokale eller i bankens egen drift) kan lage nyttige utkast uten å finne på tall, når de bare får beregnede fakta og svarene kontrolleres.

**Data**

- Banken kan, med riktig behandlingsgrunnlag og kundens medvirkning, koble kontantstrømmer med regnskap, reskontro og åpne data.
- Transaksjoner og fakturaer gir et mer handlingsrettet bilde enn periodiske regnskapstall alene.
- Datakvaliteten holder: f.eks. har flere lån i grunnlaget passert sluttdato uten å være nedbetalt, og slike avvik må fanges opp, ikke skjules.

**Kundeadferd**

- Kunder vil dele regnskapsdata når nytten er tydelig og de har kontroll over delingen.
- Proaktiv kontakt oppleves som hjelp, ikke overvåking.
- Rådgivere får verdi av forklarbare varsler og konkrete alternativer, ikke bare flere dashbord.

## Data og personvern

| Data | Bruk | Kilde | Ekte? |
|---|---|---|---|
| Bedrifter, regnskap, engasjement, kontakter og hendelser (inkl. møtenotater, restskatt, inkasso, motparter) | Kundebilde, score, tekstsignaler | `data/kundedata.json` | **Fiktiv** |
| Daglig saldo, ukentlig kontantstrøm, betalere, lån, sikkerheter, avviste betalinger | Prognose og score | `data/tilleggsdata.json` | **Syntetisk** |
| Reskontro og forfalt leverandørgjeld (48 kunder med «samtykke») | Prognosens første fire uker | `data/tilleggsdata.json` | **Syntetisk** |
| Konkurser per næring (Vestland og hele landet) | Bransjerisiko | SSB, tabell 10790 og 07091 (`ssb_konkurs` i tilleggsdata) | **Ekte**, aggregert |
| Bedriftsstatus, roller og årsregnskap | Virksomhetssøk | Brønnøysundregistrenes åpne API | **Ekte**, offentlig |
| Strømpris NO5 | Strømscenario | hvakosterstrommen.no | **Ekte**; merkes som reserveverdi når kilden ikke svarer |
| Styringsrente | Hentes, men brukes ikke i beregningene | Norges Bank | **Ekte** |

Kildedataene er i kNOK og nynorsk; `src/lib/kundedata.ts` regner om til kroner. Unntaket er beløp skrevet i hendelsesteksten (f.eks. «Restskatt 421 000 ubetalt»), som allerede er i kroner. Testene kontrollerer begge deler.

**Viktige begrensninger:**

- **Ikke bruk ekte eller personidentifiserbare kundedata i denne demoen.** Virksomhetssøket henter ekte offentlige data, inkludert navn på daglig leder og styreleder.
- De tre samtykkenivåene er **konseptuelle**. Det finnes ingen implementert samtykke- eller tilgangskontroll; alle som når appen, ser alle kunder.
- Agenda og oppfølgingslogg lagres i nettleserens `localStorage`. Tekstanalyser lagres i `data/tekstsignaler.json`, KI-køen i `data/ki-ko/` (begge utenfor git).

### AI og hva som sendes hvor

Score, prognose, scenarioer og tiltak er **regelbaserte** og beregnes i appen. Ingen språkmodell, sentimentanalyse eller nyhet endrer scoren automatisk. (Tekstsignaler fra notater og hendelser gir poeng, men bare med ordrett sitat som er kontrollert mot kilden.)

Det finnes tre veier til språkmodell, og alle er valgfrie:

- **KI-møterapporten** («rapportbroen») legger prompten i `data/ki-ko/` på disk. En Claude Code-økt i Claude Desktop svarer på den. Prompten inneholder kundens kildekatalog **med navn, notater og tall**, og går til Anthropic via Claude Code. Svaret valideres med Zod, og sitater og tall kontrolleres mot kildene før rapporten vises.
- **Samtaleunderlaget** legger en prompt med beregnede fakta – blant annet kundenavn, daglig leder, rådgivernotater, debitorer og tall – i samme kø (`POST /api/brief/generer`), og Claude Code-økten i Claude Desktop svarer. Svaret valideres mot `BriefSchema` i nettleseren før det vises. «Bruk regelbasert mal» (`/api/brief`) gir et underlag uten AI, eller fra Claude via API hvis `ANTHROPIC_API_KEY` er satt.
- **Tekstanalysen** (`/api/tekstsignaler`, `npm run tekstsignaler`) sender kundens notater og hendelser til Anthropic når nøkkelen er satt. Ellers brukes en ordliste. Signaler der sitatet ikke står ordrett i kilden, forkastes.

Ingen av veiene minimerer eller pseudonymiserer data, og sensitive situasjoner sendes med. **Bruk bare de fiktive demodataene.** En produksjonsløsning krever dataminimering, avtale med leverandøren eller modell i bankens egen drift, og en egen personvernvurdering.

API-nøkkelen leses bare på serveren og havner aldri i klientkoden.

## Kom i gang

Krever Node.js 22.18 eller nyere (testene og skriptene kjører TypeScript direkte) og npm.

```bash
npm install
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000). Ingen nøkler eller modeller trengs.

### Samtaleunderlag og tekstanalyse

«Lag samtaleunderlag» bruker køen til Claude Desktop, på samme måte som møterapporten (se under). Uten svar innen 8 minutter vises en melding, og den regelbaserte malen kan brukes i stedet. Tekstanalysen bruker ordliste uten API-nøkkel. For å prøve Claude: kopier `.env.example` til `.env.local`, sett `ANTHROPIC_API_KEY` (fra [Anthropic Console](https://console.anthropic.com)) og start utviklingsserveren på nytt. Husk at kundedata da sendes til Anthropic.

### Kontroll

```bash
npm test             # Enhetstester (node --test) for beregninger, datakonvertering og API-validering
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run build        # Produksjonsbygg
npm run sjekk        # Skriver ut score og prognose for alle kunder
npm run sjekk B-114  # Ukeprognose for én kunde
```

Testene bruker det syntetiske datagrunnlaget og gjør ingen nettverkskall.

### KI-møterapport og samtaleunderlag via Claude Desktop (uten API-nøkkel)

Knappen «Lag møterapport» på kundesiden åpner `/kunde/[id]/rapport`:

1. «Generer møterapport» sender `POST /api/rapport/generer`. Serveren bygger en prompt med en kildekatalog (bankens data for kunden, hver med ID) og et JSON-skjema fra `RapportSchema` i `src/lib/rapport.ts`, legger den i `data/ki-ko/<jobbId>.foresporsel.json` og svarer `202 { jobbId }`.
2. En Claude Code-økt følger med på køen med `./scripts/vent-pa-ki.sh`, lager svaret (med websøk om bransje, region og makro – bedriften er fiktiv) og skriver `data/ki-ko/<jobbId>.svar.json`.
3. Nettsiden spør `GET /api/rapport/status?jobb=<jobbId>` hvert 2. sekund. Etter 8 minutter uten svar får brukeren beskjed om å sjekke økten.
4. Svaret valideres med Zod. Sitater sjekkes mot katalogen, nettkilder hentes på serveren (`/api/verifiser-web`: bare https mot offentlige adresser, også etter videresendinger, maks 2 MB) og tall i teksten må finnes i de siterte kildene. Punkter uten gyldig kilde strekes over.

Prompten kan også kjøres manuelt i Claude Desktop («Kjør manuelt i Claude Desktop i stedet»).

**Ferdig forberedte rapporter:** `data/rapporter/<kundeId>.json` (i dag Tindberg Tannklinikk, B-114) vises med en gang på rapportsiden, uten å vente på køen. Serveren bruker en slik rapport bare når skjemaet passer og alle sitater og tall stemmer med dagens kildekatalog. Ellers genereres rapporten som vanlig. Rapporten for Tindberg er laget for **16. oktober 2026**, så lås demodatoen med `NEXT_PUBLIC_DEMO_DATO=2026-10-16` hvis demoen holdes en annen dag.

Samtaleunderlaget bruker samme kø: «Lag samtaleunderlag» legger `data/ki-ko/<kunde>-su-<tid>.foresporsel.json` i køen (oppgave `samtaleunderlag`), og Claude Code-økten svarer med JSON etter `BriefSchema`. **Under demoen** må Claude Code-økten være åpen og ha `./scripts/vent-pa-ki.sh` kjørende.

## Demo (ca. fem minutter)

Datagrunnlaget gjelder per 1. oktober 2026, men appen flytter alle datoene fram til **dagens dato** når dataene lastes inn (se «Beregningsmetode»). Fordi lønn, skattetrekk og MVA forfaller på faste kalenderdager, endrer tallene seg litt fra dag til dag.

**Tallene under gjelder med datoen låst til 16. oktober 2026.** Sett `NEXT_PUBLIC_DEMO_DATO=2026-10-16` i `.env.local` og start serveren på nytt for å få nøyaktig disse tallene, eller lås datoen til presentasjonsdagen og sjekk tallene med `npm run sjekk`. Åpne data (Brreg, strømpris) er reelle og påvirkes ikke av demodatoen.

1. **Før og etter:** Start i «Uten Likviditetsradar» (kundeliste og usorterte hendelser), og bytt til «Med Likviditetsradar». Vis dagens agenda.
2. **Tindberg Tannklinikk (B-114):** Kassekreditten er full, restskatten på 421 000 kr er ubetalt, og lønnen 20. oktober tar kunden over insolvensgrensen (98 % sannsynlighet). Vis postene som driver utviklingen.
3. **Når tiltakene ikke er nok:** For Tindberg bedrer den anbefalte pakken (kostnadstiltak, MVA-avtale, avdragsfrihet og kassekreditt til lån) marginen mye, men holder ikke. En viktig årsak er en sluttbetaling på 1 089 000 kr på lånet 15. januar – kortet «Dette vet vi ikke» peker på at refinansiering må avklares i samtalen.
4. **Ørnberg Trykk (B-102) – avdragsfrihet og full datatilgang:** Sunn drift med vekst (+28 % i 2025), men et nytt maskinlån på 9,0 mill. med tre års nedbetaling gir 250 000 kr i avdrag hver måned. Kunden har gitt tilgang til regnskapssystemet, så reskontroen viser både 3,4 MNOK i utestående fakturaer og 1,5 mill. i forfalt leverandørgjeld – kunden har skjøvet på leverandørene for å klare avdragene. Uten tiltak er det 93 % sannsynlighet for å passere grensen. Slå på «Avdragsfrihet i 6 måneder»: sannsynligheten faller til 16 %. Fordi kunden har gitt samtykke, er også løpende factoring mulig, og det er den anbefalte pakken (4 %). Møtenotatet viser at kunden selv har spurt om å utsette avdragene.
5. **Bjørkberg Vindu & Dør (B-075):** Kassekreditten har lenge vært over 80 % utnyttet, og det er 52 % sannsynlighet for å passere grensen; MVA-avtale alene bringer den til 18 %. Prøv scenarioet «største kunde betaler senere».
6. **Holmø Sjømat (B-005):** 62 % av innbetalingene kommer fra en motpart med betalingsanmerkning, og møtenotatet sier det samme med kundens egne ord. Vis sitatene.
7. **Kjerrland Tannhelse (B-009):** Sensitiv situasjon etter dødsfall. Kunden er tatt ut av agendaen, og den regelbaserte malen foreslår bare praktisk hjelp.
8. **Samtaleunderlag og åpne data:** Lag underlaget (se merkingen av kilde og databehandling), og gjør et oppslag i Enhetsregisteret.

## Beregningsmetode og kjente begrensninger

- **Dato:** Datagrunnlaget gjelder per 1. oktober 2026. Ved innlasting flyttes alle datoer i kundemodellen (saldo, transaksjoner, fakturaer, lån, kontakter, hendelser og ISO-datoer i hendelsestekster) like mange dager fram, slik at siste saldo er i dag (`src/lib/kundedata.ts`). Datafilene endres ikke. Faste kostnader per kalendermåned leses fra de opprinnelige datoene, så lønn den 20. og MVA-terminer fortsatt ligger på riktige kalenderdager. Ukedager i historikken forskyves, noe som påvirker sesongjusteringen litt. `NEXT_PUBLIC_DEMO_DATO=YYYY-MM-DD` låser datoen (testene bruker 2026-10-01).
- **Startpunkt:** Saldoen er ved slutten av dagens dato. Prognosen starter i morgen, så dagens bevegelser ikke telles to ganger.
- **Normal drift:** samme uke i fjor × vekst (siste 12 uker mot de samme ukene året før). Kjente forfall (lønn, skattetrekk/AGA, MVA, husleie, strøm, lån, leasing) legges på dato. MVA for måneder uten historikk beregnes av samme salgsanslag som prognosen.
- **Lån:** Serielån betales den 20., leasing den 1. (fra lånesystemet). Lån som har passert sluttdato men fortsatt har saldo, antas betjent som før og flagges. Sluttbetalinger i perioden tas med og flagges, fordi de ofte refinansieres.
- **Usikkerhet:** fra kundens egen uke-til-uke-variasjon. Sannsynligheten er en modellstørrelse, ikke en kalibrert sannsynlighet.
- **Tiltakspakken:** velger de minst inngripende tiltakene til marginen er over bufferen (5 % av rammen, minst 100 000 kr) **og** sannsynligheten er under 20 %. Samme mål avgjør om en pakke trengs. Når pakken ikke når målet, sies det tydelig.
- **Kassekreditt til lån:** begrenset til det som faktisk er trukket. Rammen beholdes, og lånet antas å ha 7,5 % rente og 5 års løpetid.
- **Porteføljeavhengigheter:** Koden kan vise når en kunde får innbetalinger fra en annen kunde i porteføljen, men betalerne i datagrunnlaget er ikke koblet til kunder i banken. Nettverksvisningen er derfor tom i dag; motpartsrisiko vises via hendelsene.
- **Ikke validert:** Score og prognose er ikke testet mot faktiske mislighold. Tersklene er skjønnsmessige.

## Datagenerering

```bash
npm run ssb           # Henter ekte konkursstatistikk fra SSB → data/ssb-konkurs.json
npm run tilleggsdata  # Genererer data/tilleggsdata.json fra kundedata.json og SSB-dataene
npm run tekstsignaler # Tekstanalyse med Claude for alle kunder (krever API-nøkkel)
```

`data/kundedata.json` er grunnlaget: 120 fiktive bedrifter i BM Bergen per 2026-10-01. Kundene er fordelt på tre fiktive rådgivere: Hanne (48 kunder, standard, med alle demokundene og alle kunder med møtenotater), Jonas (36, blant dem Skarbø Rekneskap) og Ingrid (36, blant dem Gråbø Catering). Ørnberg Trykk (B-102) er utvidet med et maskinlån, høy utnyttelse av kassekreditten og to notater, så demoen har et eksempel der avdragsfrihet er det naturlige tiltaket. Kunden har alltid gitt samtykke til regnskapsdata (`SAMTYKKE_ALLTID` i datageneratoren), og forfalt leverandørgjeld leses fra møtenotatet. `data/tilleggsdata.json` supplerer med syntetiske bankdata som er konsistente med kundedata: saldo i dag er lik saldo i Engasjement, og mønstrene i merknadene og hendelsene er gjenskapt (utnyttelse over 80 %, overtrekk, motpartsandeler på 62 % og 51 %). Kunder uten slike merknader holdes bevisst unna tersklene.

| Del | Innhold | Realistisk kilde |
|---|---|---|
| `konto_historikk` | Daglig saldo på driftskonto og trekk på kassekreditt, 365 dager | Bankens kjernesystem |
| `kontantstraum` | Ukentlige inn- og utbetalinger per kategori, 104 uker | Bankens transaksjonsdata |
| `betalarar` | Hvem innbetalingene kommer fra, og andel i 2026 | Bankens transaksjonsdata |
| `lan` | Nedbetalingsplan: avdrag, termin, neste forfall, sluttbetaling og forfalte terminer | Bankens lånesystem |
| `sikkerheiter` | Pant og kausjoner med verdi | Bankens sikkerhetsregister |
| `avviste_betalingar` | Betalinger avvist på grunn av manglende dekning | Bankens betalingssystem |
| `samtykke` og `reskontro` | Kundefordringer, forfalt leverandørgjeld og restanser for 48 kunder | Regnskapssystemets API, kun med samtykke |
| `ssb_konkurs` | Foretakskonkurser per næring, siste 8 kvartaler | **Ekte**, SSB |

## Teknologi og struktur

Next.js, React, TypeScript, Recharts og Zod. Ingen database.

| Fil | Ansvar |
|---|---|
| `src/lib/kundedata.ts` | Leser datafilene inn i appens kundemodell (kNOK → kroner) |
| `src/lib/prognose.ts`, `src/lib/kalender.ts` | 13-ukers prognose, kjente forfall, scenarioer |
| `src/lib/tiltak.ts` | Tiltak, effekt og anbefalt tiltakspakke |
| `src/lib/score.ts` | Forklarbar prioriteringsscore |
| `src/lib/usikkerhet.ts` | «Dette vet vi ikke»: manglende data og antakelser |
| `src/lib/brief.ts` | Fakta til samtaleunderlag, validering og regelbasert mal |
| `src/lib/tekst.ts`, `src/lib/tekstAi.ts` | Tekstsignaler (ordliste og Claude) med sitatkontroll |
| `src/lib/rapport.ts`, `src/lib/kiKo.ts` | KI-møterapport: skjema, kildekatalog, kø og kontroll |
| `src/lib/api.ts` | Validering av API-forespørsler (400/413/415) |
| `src/lib/brreg.ts`, `src/lib/brregTolk.ts` | Brreg-oppslag med validering og eksplisitte feiltilstander (502) |
| `src/lib/makro.ts`, `src/lib/makroTolk.ts` | Strømpris og styringsrente med validering og merket reserveverdi |
| `src/lib/nettadresse.ts` | Blokkerer interne adresser ved henting av nettkilder |
| `src/lib/agenda.ts`, `src/lib/muligheter.ts` | Dagens agenda og grunner til positiv kontakt |
| `src/lib/neste.ts` | Neste beste handling: ett forslag med ansvarlig og frist |
| `src/lib/lokal.ts` | Lagring i nettleseren for demofunksjonene (oppfølging, kredittsaker, deling, lister) |
| `src/components/KundeMote.tsx`, `src/components/KundePrognose.tsx` | Kundevisningen i møtet og rådgiverens tiltaksvisning |
| `tests/` | Enhetstester (`npm test`) |
| `scripts/` | Datagenerering, SSB-henting og kontrollutskrift |
