// Datohjelpere. Alle datoer er ISO-strenger (YYYY-MM-DD) og regnes i UTC.

// Datagrunnlaget gjelder per denne datoen (kundedata.json: «Per dato»)
export const DAGENS_DATO = "2026-10-01";

// Dager siden en dato, eller null hvis datoen mangler (f.eks. ingen registrert kontakt)
export function dagerSiden(iso: string | null): number | null {
  return iso ? dagerMellom(iso, DAGENS_DATO) : null;
}

export function tilDato(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

export function tilIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function leggTilDager(iso: string, dager: number): string {
  const d = tilDato(iso);
  d.setUTCDate(d.getUTCDate() + dager);
  return tilIso(d);
}

export function dagerMellom(fra: string, til: string): number {
  return Math.round((tilDato(til).getTime() - tilDato(fra).getTime()) / 86_400_000);
}

export function ukedag(iso: string): number {
  // 0 = mandag … 6 = søndag
  return (tilDato(iso).getUTCDay() + 6) % 7;
}

export function mandagI(iso: string): string {
  return leggTilDager(iso, -ukedag(iso));
}

const MANEDER = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

export function kortDato(iso: string): string {
  const d = tilDato(iso);
  return `${d.getUTCDate()}. ${MANEDER[d.getUTCMonth()]}`;
}

export function langDato(iso: string): string {
  const d = tilDato(iso);
  return `${d.getUTCDate()}. ${MANEDER[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function ukenummer(iso: string): number {
  const d = tilDato(iso);
  const torsdag = new Date(d);
  torsdag.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const forsteJan = new Date(Date.UTC(torsdag.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((torsdag.getTime() - forsteJan.getTime()) / 86_400_000 - 3 + ((forsteJan.getUTCDay() + 6) % 7)) / 7);
}
