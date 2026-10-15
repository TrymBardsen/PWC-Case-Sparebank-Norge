"use client";

import { useEffect, useState } from "react";
import type { EnhetTreff, Enhetsdetaljer } from "@/lib/brreg";
import { kr, mnok } from "@/lib/format";
import { Kort } from "@/components/ui";

export default function Sokside() {
  const [q, setQ] = useState("");
  const [treff, setTreff] = useState<EnhetTreff[]>([]);
  const [valgt, setValgt] = useState<Enhetsdetaljer | null>(null);
  const [laster, setLaster] = useState(false);
  const [lasterDetaljer, setLasterDetaljer] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setTreff([]);
      return;
    }
    const t = setTimeout(async () => {
      setLaster(true);
      try {
        const res = await fetch(`/api/brreg/sok?q=${encodeURIComponent(q.trim())}`);
        setTreff(((await res.json()) as { treff: EnhetTreff[] }).treff);
      } finally {
        setLaster(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function velg(orgnr: string) {
    setLasterDetaljer(true);
    try {
      const res = await fetch(`/api/brreg/${orgnr}`);
      const json = (await res.json()) as { enhet?: Enhetsdetaljer };
      setValgt(json.enhet ?? null);
    } finally {
      setLasterDetaljer(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="overtittel mb-1">Åpne data</div>
        <h1 className="font-overskrift text-3xl font-bold text-snb-rod">Søk i Enhetsregisteret</h1>
        <p className="text-sm text-slate-600">
          Ekte, åpne data fra Brønnøysundregistrene. Slik henter Likviditetsradar kundebilde, status og regnskap for nye og eksisterende kunder.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Firmanavn eller organisasjonsnummer"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-teal-600"
          />
          {laster && <p className="text-xs text-slate-500">Søker …</p>}
          <ul className="space-y-2">
            {treff.map((t) => (
              <li key={t.orgnr}>
                <button
                  onClick={() => velg(t.orgnr)}
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-left text-sm hover:border-teal-600 ${valgt?.orgnr === t.orgnr ? "border-teal-600" : "border-slate-200"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t.navn}</span>
                    {t.status.map((s) => (
                      <span key={s} className="rounded bg-red-100 px-1.5 text-[10px] font-medium text-red-700">
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t.orgnr} · {t.form} · {t.kommune}
                    {t.ansatte !== null ? ` · ${t.ansatte} ansatte` : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          {lasterDetaljer && <p className="text-sm text-slate-500">Henter fra Brreg …</p>}
          {!lasterDetaljer && valgt && <Detaljer e={valgt} />}
          {!lasterDetaljer && !valgt && (
            <Kort>
              <p className="text-sm text-slate-500">Velg en virksomhet for å se enhetsinformasjon, roller, siste regnskap og offentlige varselsignaler.</p>
            </Kort>
          )}
        </div>
      </div>
    </div>
  );
}

function Detaljer({ e }: { e: Enhetsdetaljer }) {
  const r = e.regnskap;
  const ekAndel = r?.egenkapital != null && r.sumEiendeler ? r.egenkapital / r.sumEiendeler : null;
  const likviditetsgrad = r?.omlopsmidler && r.kortsiktigGjeld ? r.omlopsmidler / r.kortsiktigGjeld : null;
  return (
    <div className="space-y-4">
      <Kort
        tittel={e.navn}
        hoyre={
          <a
            href={`https://www.proff.no/bransjes%C3%B8k?q=${e.orgnr}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:border-teal-600"
          >
            Åpne på Proff ↗
          </a>
        }
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Felt n="Org.nr." v={e.orgnr} />
          <Felt n="Organisasjonsform" v={e.form} />
          <Felt n="Bransje" v={e.bransje} />
          <Felt n="Ansatte" v={e.ansatte?.toString() ?? "–"} />
          <Felt n="Adresse" v={e.adresse} />
          <Felt n="Stiftet" v={e.stiftet ?? "–"} />
          <Felt n="Daglig leder" v={e.dagligLeder ?? "–"} />
          <Felt n="Styreleder" v={e.styreleder ?? "–"} />
        </dl>
      </Kort>

      <Kort tittel="Signaler fra offentlige data">
        {e.signaler.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-orange-800">
            {e.signaler.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-700">Ingen varselsignaler i Enhetsregisteret eller siste regnskap.</p>
        )}
      </Kort>

      <Kort tittel={r ? `Siste regnskap (${r.aar})` : "Regnskap"} hoyre={<span className="text-xs text-slate-500">Regnskapsregisteret</span>}>
        {r ? (
          <dl className="tall grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <Felt n="Driftsinntekter" v={belop(r.driftsinntekter, r.valuta)} />
            <Felt n="Driftsresultat" v={belop(r.driftsresultat, r.valuta)} />
            <Felt n="Årsresultat" v={belop(r.aarsresultat, r.valuta)} />
            <Felt n="Egenkapital" v={belop(r.egenkapital, r.valuta)} />
            <Felt n="Egenkapitalandel" v={ekAndel !== null ? `${Math.round(ekAndel * 100)} %` : "–"} />
            <Felt n="Likviditetsgrad 1" v={likviditetsgrad !== null ? likviditetsgrad.toFixed(2).replace(".", ",") : "–"} />
            <Felt n="Bankinnskudd" v={belop(r.bankinnskudd, r.valuta)} />
            <Felt n="Kortsiktig gjeld" v={belop(r.kortsiktigGjeld, r.valuta)} />
            <Felt n="Sum gjeld" v={belop(r.sumGjeld, r.valuta)} />
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Ingen regnskap tilgjengelig i det åpne API-et (gjelder f.eks. enkeltpersonforetak).</p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Det åpne API-et gir bare siste innsendte regnskap. Flerårig historikk og kredittvurdering kan hentes fra Proff eller et kredittopplysningsbyrå via avtale.
        </p>
      </Kort>
    </div>
  );
}

function belop(v: number | null, valuta: string) {
  if (v === null) return "–";
  if (valuta !== "NOK") return `${mnok(v).replace("MNOK", "M")} ${valuta}`;
  return Math.abs(v) >= 10_000_000 ? mnok(v) : kr(v);
}

function Felt({ n, v }: { n: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{n}</dt>
      <dd className="text-slate-900">{v}</dd>
    </div>
  );
}
