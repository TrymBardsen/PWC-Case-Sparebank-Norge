import type { DagSaldo } from "@/lib/types";
import type { Prognose } from "@/lib/prognose";
import { kortDato } from "@/lib/dato";
import { mnok } from "@/lib/format";

// Samme farger som PrognoseGraf (som er en klientkomponent og ikke kan importeres herfra)
const FARGE = { historikk: "#333333", prognose: "#006858", kritisk: "#ff4238" };

const B = 132;
const H = 36;
const DAGER_BAKOVER = 90;

// Liten saldokurve: siste 90 dager faktisk saldo og 13 ukers prognose, med insolvensgrensen stiplet.
export function Minigraf({ historikk, prognose }: { historikk: DagSaldo[]; prognose: Prognose }) {
  const faktisk = historikk.slice(-DAGER_BAKOVER).map((d) => d.saldo);
  const fremover = prognose.dager.map((d) => d.saldo);
  const grense = -prognose.ramme;
  const alle = [...faktisk, ...fremover, grense, 0];
  const min = Math.min(...alle);
  const max = Math.max(...alle);
  const spenn = max - min || 1;
  const n = faktisk.length + fremover.length - 1;
  const x = (i: number) => (i / n) * B;
  const y = (v: number) => 2 + (1 - (v - min) / spenn) * (H - 4);
  const sti = (verdier: number[], start: number) => verdier.map((v, i) => `${i ? "L" : "M"}${x(start + i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  const passerer = prognose.tomKasseDato !== null;
  const idag = x(faktisk.length - 1);
  const tittel = `Saldo i dag ${mnok(faktisk[faktisk.length - 1])} · laveste i prognosen ${mnok(prognose.lavesteSaldo)} (${kortDato(prognose.lavesteDato)}) · grense ${mnok(grense)}`;

  return (
    <svg width={B} height={H} viewBox={`0 0 ${B} ${H}`} role="img" aria-label={tittel} className="block overflow-visible">
      <title>{tittel}</title>
      {prognose.ramme > 0 && <line x1={0} x2={B} y1={y(grense)} y2={y(grense)} stroke={FARGE.kritisk} strokeWidth={1} strokeDasharray="3 2" />}
      <line x1={idag} x2={idag} y1={0} y2={H} stroke="#cbd5e1" strokeWidth={1} />
      <path d={sti(faktisk, 0)} fill="none" stroke={FARGE.historikk} strokeWidth={1.25} strokeLinejoin="round" />
      <path
        d={sti([faktisk[faktisk.length - 1], ...fremover], faktisk.length - 1)}
        fill="none"
        stroke={passerer ? FARGE.kritisk : FARGE.prognose}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
