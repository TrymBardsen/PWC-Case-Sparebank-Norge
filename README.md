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
| `src/lib/prognose.ts` | 13-ukers prognose dag for dag, scenarioer og tiltak |
| `src/lib/kalender.ts` | Kjente forfall: lønn, skatt/AGA, MVA-terminer, husleie, strøm, lån |
| `src/lib/score.ts` | Prioriteringsscore med forklaring per faktor, smitte i porteføljen |
| `src/lib/brief.ts` | Fakta til Claude, skjema for svaret og regelbasert reserve |
| `src/lib/brreg.ts` | Oppslag mot Brønnøysundregistrene |

## Demo-manus (ca. 4 min)

1. **Portefølje:** «God morgen, Kari.» Åsane Interiør er øverst, men de har allerede ringt selv. Det interessante er nr. 2.
2. **Fjellsiden Bygg:** Ingen har ringt. Prognosen viser tom kasse 20. november når lønnen går ut, fem uker frem i tid. «Hvorfor»-panelet viser signalene: innbetalinger ned 25 %, avviste betalinger, en forfalt termin.
3. **Hva om:** Slå på «Vestland Eiendom betaler 30 dager senere». Rådgivernotatet fra august sa at de drar ut betalingene. Underskuddet øker til 1,8 MNOK.
4. **Tiltak:** Slå på løpende factoring. Prognosen holder hele perioden. Sammenlign med midlertidig ramme.
5. **Forbered samtale:** Samtaleunderlag med åpningsreplikk, spørsmål og rangerte tiltak. Merket som utkast, og rådgiveren bestemmer.
6. **Smitte:** Sandviken Rør får 46 % av innbetalingene fra Fjellsiden og løftes automatisk på listen. Uten samtykke til regnskapsdata er prognosen bredere.
7. **Søk:** Slå opp en ekte bedrift i Enhetsregisteret og vis signalene fra offentlige data.
