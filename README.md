# Likviditetsradar

Demo for PwC-hackathon: AI-støttet tidligvarsling av likviditetsskvis for kunderådgivere i bedriftsmarkedet.

## Kom i gang

```bash
npm install
npm run dev
```

Åpne http://localhost:3000.

### AI-samtaleunderlag (valgfritt)

Knappen «Forbered samtale» bruker Claude via API. Uten nøkkel vises en regelbasert mal.

1. Lag en API-konto på https://console.anthropic.com (Claude Pro gir ikke API-tilgang) og legg inn litt kreditt.
2. Kopier `.env.example` til `.env.local` og sett `ANTHROPIC_API_KEY`.
3. Start `npm run dev` på nytt.

Ett samtaleunderlag koster noen få øre.

## Data

- `npm run data` genererer `data/portefolje.json` (14 fiktive Bergen-bedrifter, syntetiske bankdata). Profilene ligger i `scripts/generer-data.ts`.
- `node scripts/sjekk.ts [kunde-id]` skriver ut score og prognose for alle kunder, nyttig når man justerer profilene.
- Demo-datoen er fast: `DAGENS_DATO` i `src/lib/dato.ts` (15. okt 2026).
- Ekte data: Enhetsregisteret, Regnskapsregisteret, Norges Banks styringsrente og strømpris NO5.

## Struktur

| Fil | Innhold |
|---|---|
| `src/lib/prognose.ts` | 13-ukers prognose dag for dag (egen sesong, dempet trend, usikkerhet), insolvensgrense og sannsynlighet |
| `src/lib/kalender.ts` | Kjente forfall: lønn, skatt/AGA, MVA-terminer, husleie, strøm, lån |
| `src/lib/tiltak.ts` | Tiltakskatalog, effekt per tiltak og anbefalt pakke |
| `src/lib/score.ts` | Prioriteringsscore med forklaring per faktor, smitte i porteføljen |
| `src/lib/brief.ts` | Fakta til Claude, skjema for svaret og regelbasert reserve |
| `src/lib/brreg.ts` | Oppslag mot Brønnøysundregistrene |

## Demo-manus (ca. 4 min)

1. **Portefølje:** «God morgen, Kari.» Åsane Interiør er øverst, men de har allerede ringt selv. Det interessante er nr. 2.
2. **Fjellsiden Bygg:** Ingen har ringt. Prognosen passerer insolvensgrensen (−2,5 MNOK, kassekreditten brukt opp) 20. november når lønnen går ut, med 74 % sannsynlighet. Den røde sonen og ukestripen viser når risikoen er størst.
3. **Hva om:** Slå på «Vestland Eiendom betaler 30 dager senere». Rådgivernotatet fra august sa at de drar ut betalingene. Grensen passeres 15. november, og underskuddet vokser.
4. **Tiltak mot mislighold:** Slå av scenarioet. Slå på avdragsfrihet og betalingsavtale for MVA, som gir kunden pusterom uten nye bankprodukter. Søylediagrammet viser at det ikke er nok alene. Legg til kostnadstiltak, og kombinasjonen havner over grensen.
5. **Anbefalt pakke:** «Vis i prognosen». Løpende factoring holder kunden 0,8 MNOK over grensen, og sannsynligheten faller fra 74 % til 5 %. Betalingslettelser er merket.
6. **Forbered samtale:** Samtaleunderlag med åpningsreplikk, spørsmål og tiltak med effekt i kroner. Merket som utkast, og rådgiveren bestemmer.
7. **Kontrast:** Åsane Interiør. Selv anbefalt pakke er ikke nok, så appen anbefaler spesialenhet eller rekonstruksjon.
8. **Smitte og søk:** Sandviken Rør får 46 % av innbetalingene fra Fjellsiden. Avslutt med et ekte oppslag i Enhetsregisteret.
