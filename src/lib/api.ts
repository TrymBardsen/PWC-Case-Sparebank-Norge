// Felles validering av forespørsler til API-rutene. Ugyldig input gir tydelige HTTP-feil
// (400/413/415) i stedet for at ruten krasjer med 500.

import { z } from "zod";

const MAKS_BYTE = 10_000;

export const KundeId = z.string().regex(/^[A-Za-z0-9-]{1,20}$/, "Ugyldig kunde-ID");
export const KundeForesporsel = z.object({ kundeId: KundeId }).strict();

export const feil = (status: number, melding: string) => Response.json({ feil: melding }, { status });

export type Tolket<T> = { ok: true; data: T } | { ok: false; svar: Response };

export async function lesJson<T>(req: Request, schema: z.ZodType<T>, maksByte = MAKS_BYTE): Promise<Tolket<T>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return { ok: false, svar: feil(415, "Forventet Content-Type: application/json") };
  const tekst = await req.text();
  if (new TextEncoder().encode(tekst).length > maksByte) return { ok: false, svar: feil(413, "Forespørselen er for stor") };
  let raa: unknown;
  try {
    raa = JSON.parse(tekst);
  } catch {
    return { ok: false, svar: feil(400, "Ugyldig JSON") };
  }
  const tolket = schema.safeParse(raa);
  if (!tolket.success) {
    const forste = tolket.error.issues[0];
    return { ok: false, svar: feil(400, `Ugyldig forespørsel: ${forste?.path.join(".") || "body"} – ${forste?.message ?? "ukjent feil"}`) };
  }
  return { ok: true, data: tolket.data };
}
