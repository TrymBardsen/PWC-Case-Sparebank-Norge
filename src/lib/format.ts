const nf = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

// Beløp fra 100 000 kr rundes til nærmeste tusen: prognoser og anslag er ikke presise på kronen.
export function kr(belop: number): string {
  const rundet = Math.abs(belop) >= 100_000 ? Math.round(belop / 1000) * 1000 : Math.round(belop);
  return `${nf.format(rundet)} kr`;
}

// Eksakte beløp, f.eks. fakturaer og terminer fra regnskap og lånesystem
export function krPresis(belop: number): string {
  return `${nf.format(Math.round(belop))} kr`;
}

// Kort beløp: MNOK fra én million, ellers kr (rundet)
export function belop(x: number): string {
  return Math.abs(x) >= 1_000_000 ? mnok(x) : kr(x);
}

// «1 kunde», «2 kunder»
export function antall(n: number, entall: string, flertall: string): string {
  return `${n} ${n === 1 ? entall : flertall}`;
}

export function tall(belop: number): string {
  return nf.format(Math.round(belop));
}

export function mnok(belop: number): string {
  const m = belop / 1_000_000;
  return `${m.toFixed(Math.abs(m) >= 10 ? 0 : 1).replace(".", ",")} MNOK`;
}

export function tusen(belop: number): string {
  return `${nf.format(Math.round(belop / 1000))}k`;
}

export function prosent(andel: number): string {
  return `${Math.round(andel * 100)} %`;
}

export function omUker(uker: number): string {
  return uker === 0 ? "denne uken" : uker === 1 ? "om 1 uke" : `om ${uker} uker`;
}

// Liten forbokstav midt i en setning, men behold forkortelser: «Betalingsavtale for MVA» → «betalingsavtale for MVA», «MVA 4. termin» uendret
export function liten(tekst: string): string {
  return /^[A-ZÆØÅ][a-zæøå]/.test(tekst) ? tekst.charAt(0).toLowerCase() + tekst.slice(1) : tekst;
}
