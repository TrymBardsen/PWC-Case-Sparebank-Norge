// Tolking av svar fra Brønnøysundregistrenes åpne API-er (Enhetsregisteret og Regnskapsregisteret).
// Svarene valideres med Zod før bruk; felt vi ikke kjenner igjen, ignoreres.

import { z } from "zod";

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
  mangler: string[]; // deler som ikke kunne hentes (f.eks. «roller», «regnskap»)
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

const Adresse = z.object({
  adresse: z.array(z.string()).optional(),
  postnummer: z.string().optional(),
  poststed: z.string().optional(),
  kommune: z.string().optional(),
});

export const EnhetSchema = z.object({
  organisasjonsnummer: z.string().regex(/^\d{9}$/),
  navn: z.string(),
  organisasjonsform: z.object({ kode: z.string() }).optional(),
  forretningsadresse: Adresse.optional(),
  postadresse: Adresse.optional(),
  naeringskode1: z.object({ kode: z.string(), beskrivelse: z.string() }).optional(),
  antallAnsatte: z.number().optional(),
  konkurs: z.boolean().optional(),
  underAvvikling: z.boolean().optional(),
  underTvangsavviklingEllerTvangsopplosning: z.boolean().optional(),
  slettedato: z.string().optional(),
  stiftelsesdato: z.string().optional(),
  sisteInnsendteAarsregnskap: z.union([z.string(), z.number()]).optional(),
});
export type Enhet = z.infer<typeof EnhetSchema>;

export const SokSchema = z.object({ _embedded: z.object({ enheter: z.array(EnhetSchema) }).optional() });

const tall = z.number().nullable().optional();
export const RegnskapListeSchema = z.array(
  z.object({
    regnskapstype: z.string().optional(),
    valuta: z.string().optional(),
    regnskapsperiode: z.object({ tilDato: z.string().optional() }).optional(),
    resultatregnskapResultat: z
      .object({ aarsresultat: tall, driftsresultat: z.object({ driftsresultat: tall, driftsinntekter: z.object({ sumDriftsinntekter: tall }).optional() }).optional() })
      .optional(),
    egenkapitalGjeld: z
      .object({
        egenkapital: z.object({ sumEgenkapital: tall }).optional(),
        gjeldOversikt: z.object({ sumGjeld: tall, kortsiktigGjeld: z.object({ sumKortsiktigGjeld: tall }).optional() }).optional(),
      })
      .optional(),
    eiendeler: z.object({ sumEiendeler: tall, sumBankinnskuddOgKontanter: tall, omloepsmidler: z.object({ sumOmloepsmidler: tall }).optional() }).optional(),
  }),
);

const Navn = z.object({ fornavn: z.string().optional(), mellomnavn: z.string().optional(), etternavn: z.string().optional() });
export const RollerSchema = z.object({
  rollegrupper: z
    .array(
      z.object({
        roller: z
          .array(
            z.object({
              type: z.object({ kode: z.string() }).optional(),
              avregistrert: z.boolean().optional(),
              person: z.object({ navn: Navn.optional() }).optional(),
              enhet: z.object({ navn: z.union([z.string(), z.array(z.string())]).optional() }).optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export function tilTreff(e: Enhet): EnhetTreff {
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

export function tilRegnskap(liste: z.infer<typeof RegnskapListeSchema> | null): Regnskap | null {
  if (!liste?.length) return null;
  // Foretrekk selskapsregnskap, nyeste periode
  const sortert = [...liste].sort((a, b) => (b.regnskapsperiode?.tilDato ?? "").localeCompare(a.regnskapsperiode?.tilDato ?? ""));
  const r = sortert.find((x) => x.regnskapstype === "SELSKAP") ?? sortert[0];
  const res = r.resultatregnskapResultat;
  const eg = r.egenkapitalGjeld;
  const ei = r.eiendeler;
  const aar = Number((r.regnskapsperiode?.tilDato ?? "").slice(0, 4));
  return {
    aar: Number.isFinite(aar) ? aar : 0,
    valuta: r.valuta ?? "NOK",
    driftsinntekter: res?.driftsresultat?.driftsinntekter?.sumDriftsinntekter ?? null,
    driftsresultat: res?.driftsresultat?.driftsresultat ?? null,
    aarsresultat: res?.aarsresultat ?? null,
    egenkapital: eg?.egenkapital?.sumEgenkapital ?? null,
    sumGjeld: eg?.gjeldOversikt?.sumGjeld ?? null,
    kortsiktigGjeld: eg?.gjeldOversikt?.kortsiktigGjeld?.sumKortsiktigGjeld ?? null,
    omlopsmidler: ei?.omloepsmidler?.sumOmloepsmidler ?? null,
    bankinnskudd: ei?.sumBankinnskuddOgKontanter ?? null,
    sumEiendeler: ei?.sumEiendeler ?? null,
  };
}

export function personnavn(roller: z.infer<typeof RollerSchema> | null, kode: string): string | null {
  for (const g of roller?.rollegrupper ?? []) {
    for (const r of g.roller ?? []) {
      if (r.type?.kode !== kode || r.avregistrert) continue;
      const n = r.person?.navn;
      if (n) return [n.fornavn, n.mellomnavn, n.etternavn].filter(Boolean).join(" ") || null;
      if (r.enhet?.navn) return Array.isArray(r.enhet.navn) ? r.enhet.navn.join(" ") : r.enhet.navn;
    }
  }
  return null;
}

// Svake signaler fra offentlige data
export function signalerFor(treff: EnhetTreff, sisteAarsregnskap: number | null, r: Regnskap | null, iAar: number): string[] {
  const signaler: string[] = [...treff.status];
  if (sisteAarsregnskap !== null && sisteAarsregnskap < iAar - 1 && ["AS", "ASA"].includes(treff.form)) {
    signaler.push(`Siste innsendte årsregnskap er for ${sisteAarsregnskap} – regnskapet for ${iAar - 1} skulle vært levert innen 31. juli.`);
  }
  if (r?.egenkapital != null && r.egenkapital < 0) signaler.push("Negativ egenkapital i siste regnskap.");
  if (r?.aarsresultat != null && r.aarsresultat < 0) signaler.push("Underskudd i siste regnskap.");
  if (r?.omlopsmidler && r.kortsiktigGjeld && r.omlopsmidler / r.kortsiktigGjeld < 1) {
    signaler.push(`Likviditetsgrad 1 er ${(r.omlopsmidler / r.kortsiktigGjeld).toFixed(2).replace(".", ",")} (under 1).`);
  }
  return signaler;
}

export function tilDetaljer(
  e: Enhet,
  roller: z.infer<typeof RollerSchema> | null,
  regnskap: z.infer<typeof RegnskapListeSchema> | null,
  iAar: number,
  mangler: string[] = [],
): Enhetsdetaljer {
  const treff = tilTreff(e);
  const r = tilRegnskap(regnskap);
  const siste = e.sisteInnsendteAarsregnskap !== undefined ? Number(e.sisteInnsendteAarsregnskap) : NaN;
  const sisteAarsregnskap = Number.isFinite(siste) ? siste : null;
  const adr = e.forretningsadresse ?? e.postadresse;
  return {
    ...treff,
    adresse: adr ? `${(adr.adresse ?? []).join(", ")}, ${adr.postnummer ?? ""} ${adr.poststed ?? ""}`.trim() : "",
    stiftet: e.stiftelsesdato ?? null,
    sisteAarsregnskap,
    dagligLeder: personnavn(roller, "DAGL"),
    styreleder: personnavn(roller, "LEDE"),
    regnskap: r,
    signaler: signalerFor(treff, sisteAarsregnskap, r, iAar),
    mangler,
  };
}
