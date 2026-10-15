import "server-only";

// Åpne data fra Brønnøysundregistrene (Enhetsregisteret og Regnskapsregisteret).

const BASE = "https://data.brreg.no";

export interface EnhetTreff {
  orgnr: string;
  navn: string;
  form: string;
  kommune: string;
  bransje: string;
  ansatte: number | null;
  status: string[];
}

export interface Enhetsdetaljer extends EnhetTreff {
  adresse: string;
  stiftet: string | null;
  sisteAarsregnskap: number | null;
  dagligLeder: string | null;
  styreleder: string | null;
  regnskap: Regnskap | null;
  signaler: string[];
}

export interface Regnskap {
  aar: number;
  valuta: string;
  driftsinntekter: number | null;
  driftsresultat: number | null;
  aarsresultat: number | null;
  egenkapital: number | null;
  sumGjeld: number | null;
  kortsiktigGjeld: number | null;
  omlopsmidler: number | null;
  bankinnskudd: number | null;
  sumEiendeler: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function tilTreff(e: any): EnhetTreff {
  const status: string[] = [];
  if (e.konkurs) status.push("Konkurs");
  if (e.underAvvikling) status.push("Under avvikling");
  if (e.underTvangsavviklingEllerTvangsopplosning) status.push("Tvangsavvikling");
  if (e.slettedato) status.push("Slettet");
  return {
    orgnr: e.organisasjonsnummer,
    navn: e.navn,
    form: e.organisasjonsform?.kode ?? "",
    kommune: e.forretningsadresse?.kommune ?? e.postadresse?.kommune ?? "",
    bransje: e.naeringskode1 ? `${e.naeringskode1.kode} ${e.naeringskode1.beskrivelse}` : "",
    ansatte: e.antallAnsatte ?? null,
    status,
  };
}

async function hentJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function sokEnheter(q: string): Promise<EnhetTreff[]> {
  const rent = q.replace(/\s/g, "");
  if (/^\d{9}$/.test(rent)) {
    const e = await hentJson(`${BASE}/enhetsregisteret/api/enheter/${rent}`);
    return e ? [tilTreff(e)] : [];
  }
  const json = await hentJson(`${BASE}/enhetsregisteret/api/enheter?navn=${encodeURIComponent(q)}&size=12`);
  return (json?._embedded?.enheter ?? []).map(tilTreff);
}

function hentRegnskap(liste: any[] | null): Regnskap | null {
  if (!liste?.length) return null;
  // Foretrekk selskapsregnskap, nyeste periode
  const r = [...liste].sort((a, b) => (b.regnskapsperiode?.tilDato ?? "").localeCompare(a.regnskapsperiode?.tilDato ?? "")).find((x) => x.regnskapstype === "SELSKAP") ?? liste[0];
  const res = r.resultatregnskapResultat ?? {};
  const eg = r.egenkapitalGjeld ?? {};
  const ei = r.eiendeler ?? {};
  return {
    aar: Number((r.regnskapsperiode?.tilDato ?? "0").slice(0, 4)),
    valuta: r.valuta ?? "NOK",
    driftsinntekter: res.driftsresultat?.driftsinntekter?.sumDriftsinntekter ?? null,
    driftsresultat: res.driftsresultat?.driftsresultat ?? null,
    aarsresultat: res.aarsresultat ?? null,
    egenkapital: eg.egenkapital?.sumEgenkapital ?? null,
    sumGjeld: eg.gjeldOversikt?.sumGjeld ?? null,
    kortsiktigGjeld: eg.gjeldOversikt?.kortsiktigGjeld?.sumKortsiktigGjeld ?? null,
    omlopsmidler: ei.omloepsmidler?.sumOmloepsmidler ?? null,
    bankinnskudd: ei.sumBankinnskuddOgKontanter ?? null,
    sumEiendeler: ei.sumEiendeler ?? null,
  };
}

function personnavn(roller: any, kode: string): string | null {
  for (const g of roller?.rollegrupper ?? []) {
    for (const r of g.roller ?? []) {
      if (r.type?.kode === kode && !r.avregistrert) {
        if (r.person?.navn) return [r.person.navn.fornavn, r.person.navn.mellomnavn, r.person.navn.etternavn].filter(Boolean).join(" ");
        if (r.enhet?.navn) return Array.isArray(r.enhet.navn) ? r.enhet.navn.join(" ") : r.enhet.navn;
      }
    }
  }
  return null;
}

export async function hentEnhet(orgnr: string, iAar: number): Promise<Enhetsdetaljer | null> {
  const [e, roller, regnskap] = await Promise.all([
    hentJson(`${BASE}/enhetsregisteret/api/enheter/${orgnr}`),
    hentJson(`${BASE}/enhetsregisteret/api/enheter/${orgnr}/roller`),
    hentJson(`${BASE}/regnskapsregisteret/regnskap/${orgnr}`),
  ]);
  if (!e) return null;
  const treff = tilTreff(e);
  const r = hentRegnskap(regnskap);
  const sisteAarsregnskap = e.sisteInnsendteAarsregnskap ? Number(e.sisteInnsendteAarsregnskap) : null;

  // Svake signaler fra offentlige data
  const signaler: string[] = [...treff.status];
  if (sisteAarsregnskap !== null && sisteAarsregnskap < iAar - 1 && ["AS", "ASA"].includes(treff.form)) {
    signaler.push(`Siste innsendte årsregnskap er for ${sisteAarsregnskap} – regnskapet for ${iAar - 1} skulle vært levert innen 31. juli.`);
  }
  if (r?.egenkapital !== null && r?.egenkapital !== undefined && r.egenkapital < 0) signaler.push("Negativ egenkapital i siste regnskap.");
  if (r?.aarsresultat !== null && r?.aarsresultat !== undefined && r.aarsresultat < 0) signaler.push("Underskudd i siste regnskap.");
  if (r?.omlopsmidler && r.kortsiktigGjeld && r.omlopsmidler / r.kortsiktigGjeld < 1) {
    signaler.push(`Likviditetsgrad 1 er ${(r.omlopsmidler / r.kortsiktigGjeld).toFixed(2).replace(".", ",")} (under 1).`);
  }

  const adr = e.forretningsadresse ?? e.postadresse;
  return {
    ...treff,
    adresse: adr ? `${(adr.adresse ?? []).join(", ")}, ${adr.postnummer ?? ""} ${adr.poststed ?? ""}`.trim() : "",
    stiftet: e.stiftelsesdato ?? null,
    sisteAarsregnskap,
    dagligLeder: personnavn(roller, "DAGL"),
    styreleder: personnavn(roller, "LEDE"),
    regnskap: r,
    signaler,
  };
}
