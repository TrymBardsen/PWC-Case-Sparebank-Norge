const nf = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

export function kr(belop: number): string {
  return `${nf.format(Math.round(belop))} kr`;
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
