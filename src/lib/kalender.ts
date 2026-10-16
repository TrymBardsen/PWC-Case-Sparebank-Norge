// Kjente, forutsigbare utbetalinger de neste 13 ukene (brukes av prognosemotoren).

import type { Kunde } from "./types.ts";
import { leggTilDager, tilDato } from "./dato.ts";

export type Kategori = "lonn" | "skatt" | "mva" | "husleie" | "strom" | "lan" | "feriepenger";

export interface KjentPost {
  dato: string;
  navn: string;
  belop: number;
  kategori: Kategori;
}

// MVA-terminer: forfall og hvilke to måneder terminen dekker (0-indeksert)
const MVA_FORFALL: { mnd: number; dag: number; termin: string }[] = [
  { mnd: 1, dag: 10, termin: "6. termin (nov–des)" },
  { mnd: 3, dag: 10, termin: "1. termin (jan–feb)" },
  { mnd: 5, dag: 10, termin: "2. termin (mar–apr)" },
  { mnd: 7, dag: 31, termin: "3. termin (mai–jun)" },
  { mnd: 9, dag: 10, termin: "4. termin (jul–aug)" },
  { mnd: 11, dag: 10, termin: "5. termin (sep–okt)" },
];

const SKATT_MANEDER = [0, 2, 4, 6, 8, 10]; // forskuddstrekk og AGA forfaller 15. i disse

export interface KalenderValg {
  estimertInnPerMnd: number;
  // Anslått innbetaling for en bestemt måned uten historikk (brukes foran estimertInnPerMnd)
  estimertInnForMaaned?: (aar: number, mnd: number) => number;
  // Faktiske innbetalinger for en måned (år, 0-indeksert måned) når de er kjent
  innForMaaned?: (aar: number, mnd: number) => number | undefined;
  stromFaktor?: number; // 1 = dagens pris
  renteTillegg?: number; // prosentpoeng som desimal, f.eks. 0.01
  utenAvdrag?: boolean;
}

export function kjentePoster(kunde: Kunde, fra: string, til: string, valg: KalenderValg): KjentPost[] {
  const poster: KjentPost[] = [];
  const f = kunde.faste;
  const stromFaktor = valg.stromFaktor ?? 1;
  const renteTillegg = valg.renteTillegg ?? 0;

  for (let iso = fra; iso < til; iso = leggTilDager(iso, 1)) {
    const d = tilDato(iso);
    const dag = d.getUTCDate();
    const mnd = d.getUTCMonth();

    if (dag === 1 && f.husleiePerMnd > 0) {
      poster.push({ dato: iso, navn: "Husleie", belop: f.husleiePerMnd, kategori: "husleie" });
    }
    if (f.perMnd) {
      // Datadrevet: beløp fra samme måned i fjor (inkl. feriepenger, halv skatt og sesong)
      if (dag === 20 && f.perMnd.lonn[mnd] > 0) {
        poster.push({ dato: iso, navn: mnd === 5 ? "Lønn og feriepenger" : mnd === 11 ? "Lønn (halv skatt)" : "Lønn", belop: Math.round(f.perMnd.lonn[mnd]), kategori: "lonn" });
      }
      if (dag === 15 && f.perMnd.skattetrekkOgAga[mnd] > 0) {
        poster.push({ dato: iso, navn: "Forskuddstrekk og arbeidsgiveravgift", belop: Math.round(f.perMnd.skattetrekkOgAga[mnd]), kategori: "skatt" });
      }
      if (dag === 15 && f.perMnd.strom[mnd] > 0) {
        poster.push({ dato: iso, navn: "Strøm", belop: Math.round(f.perMnd.strom[mnd] * stromFaktor), kategori: "strom" });
      }
    }
    if (!f.perMnd && dag === 20 && f.bruttoLonnPerMnd > 0) {
      // Desember: halv skatt gir høyere nettoutbetaling
      const andel = mnd === 11 ? 0.85 : 0.7;
      poster.push({
        dato: iso,
        navn: mnd === 11 ? "Lønn (halv skatt)" : "Lønn",
        belop: Math.round(f.bruttoLonnPerMnd * andel),
        kategori: "lonn",
      });
    }
    if (!f.perMnd && dag === 20 && mnd === 5 && f.bruttoLonnPerMnd > 0) {
      poster.push({
        dato: iso,
        navn: "Feriepenger",
        belop: Math.round(f.bruttoLonnPerMnd * 12 * 0.102 * 0.7),
        kategori: "feriepenger",
      });
    }
    if (!f.perMnd && dag === 15 && SKATT_MANEDER.includes(mnd) && f.bruttoLonnPerMnd > 0) {
      poster.push({
        dato: iso,
        navn: "Forskuddstrekk og arbeidsgiveravgift",
        belop: Math.round(f.bruttoLonnPerMnd * 2 * (0.3 + 0.141)),
        kategori: "skatt",
      });
    }
    if (!f.perMnd && dag === 15 && f.stromPerMnd > 0) {
      poster.push({ dato: iso, navn: "Strøm", belop: Math.round(f.stromPerMnd * stromFaktor), kategori: "strom" });
    }
    for (const m of MVA_FORFALL) {
      if (mnd === m.mnd && dag === m.dag) {
        // Terminen dekker de to månedene som slutter to måneder før forfall
        const grunnlag = [3, 2].reduce((sum, tilbake) => {
          const t = new Date(Date.UTC(d.getUTCFullYear(), mnd - tilbake, 1));
          const [a, m] = [t.getUTCFullYear(), t.getUTCMonth()];
          return sum + (valg.innForMaaned?.(a, m) ?? valg.estimertInnForMaaned?.(a, m) ?? valg.estimertInnPerMnd);
        }, 0);
        poster.push({
          dato: iso,
          navn: `MVA ${m.termin}`,
          belop: Math.round(grunnlag * f.mvaAndelAvOmsetning),
          kategori: "mva",
        });
      }
    }
    // Sluttbetaling (restverdi) på lån og leasing som går ut i perioden
    for (const lan of kunde.lan) {
      if (lan.sluttdato === iso && (lan.sluttbetaling ?? 0) > 0) {
        poster.push({ dato: iso, navn: `${lan.navn}: sluttbetaling`, belop: lan.sluttbetaling!, kategori: "lan" });
      }
    }
    for (const lan of kunde.lan) {
      if (dag !== (lan.forfallsdag ?? 20)) continue;
      // Lån som går ut i perioden: ingen terminer etter sluttdato. Lån som har passert
      // sluttdato før perioden, men fortsatt har saldo, betjenes som før til de er avklart.
      if (lan.sluttdato && iso > lan.sluttdato && lan.sluttdato >= fra) continue;
      const rente = Math.round((lan.saldo * (lan.rentesats + renteTillegg)) / 12);
      const avdrag = valg.utenAvdrag ? 0 : lan.avdragPerMnd;
      poster.push({
        dato: iso,
        navn: valg.utenAvdrag ? `${lan.navn}: kun renter` : `${lan.navn}: termin`,
        belop: rente + avdrag,
        kategori: "lan",
      });
    }
  }
  return poster;
}
