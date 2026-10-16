import "server-only";
import type { z } from "zod";
import { EnhetSchema, RegnskapListeSchema, RollerSchema, SokSchema, tilDetaljer, tilTreff, type Enhetsdetaljer, type EnhetTreff } from "./brregTolk.ts";

export type { EnhetTreff, Enhetsdetaljer, Regnskap } from "./brregTolk.ts";

// Åpne data fra Brønnøysundregistrene (Enhetsregisteret og Regnskapsregisteret).
// Nettverksfeil og uventede svar gir BrregUtilgjengelig, så rutene kan svare 502 i stedet
// for å late som om enheten ikke finnes.

const BASE = "https://data.brreg.no";

export class BrregUtilgjengelig extends Error {}

type Hentet<T> = { type: "ok"; data: T } | { type: "finnes-ikke" } | { type: "feil"; grunn: string };

async function hent<T>(url: string, schema: z.ZodType<T>): Promise<Hentet<T>> {
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } });
  } catch (e) {
    return { type: "feil", grunn: e instanceof Error && e.name === "TimeoutError" ? "tidsavbrudd" : "nettverksfeil" };
  }
  if (res.status === 404 || res.status === 410) return { type: "finnes-ikke" };
  if (!res.ok) return { type: "feil", grunn: `HTTP ${res.status}` };
  const tolket = schema.safeParse(await res.json().catch(() => undefined));
  if (!tolket.success) return { type: "feil", grunn: "uventet svarformat" };
  return { type: "ok", data: tolket.data };
}

export async function sokEnheter(q: string): Promise<EnhetTreff[]> {
  const rent = q.replace(/\s/g, "");
  if (/^\d{9}$/.test(rent)) {
    const e = await hent(`${BASE}/enhetsregisteret/api/enheter/${rent}`, EnhetSchema);
    if (e.type === "feil") throw new BrregUtilgjengelig(e.grunn);
    return e.type === "ok" ? [tilTreff(e.data)] : [];
  }
  const svar = await hent(`${BASE}/enhetsregisteret/api/enheter?navn=${encodeURIComponent(q)}&size=12`, SokSchema);
  if (svar.type === "feil") throw new BrregUtilgjengelig(svar.grunn);
  return svar.type === "ok" ? (svar.data._embedded?.enheter ?? []).map(tilTreff) : [];
}

// null = enheten finnes ikke. Roller og regnskap er valgfrie; feiler de, står de i «mangler».
export async function hentEnhet(orgnr: string, iAar: number): Promise<Enhetsdetaljer | null> {
  const [e, roller, regnskap] = await Promise.all([
    hent(`${BASE}/enhetsregisteret/api/enheter/${orgnr}`, EnhetSchema),
    hent(`${BASE}/enhetsregisteret/api/enheter/${orgnr}/roller`, RollerSchema),
    hent(`${BASE}/regnskapsregisteret/regnskap/${orgnr}`, RegnskapListeSchema),
  ]);
  if (e.type === "feil") throw new BrregUtilgjengelig(e.grunn);
  if (e.type === "finnes-ikke") return null;
  const mangler = [...(roller.type === "feil" ? ["roller"] : []), ...(regnskap.type === "feil" ? ["regnskap"] : [])];
  return tilDetaljer(e.data, roller.type === "ok" ? roller.data : null, regnskap.type === "ok" ? regnskap.data : null, iAar, mangler);
}
