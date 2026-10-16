import "server-only";
import { cookies } from "next/headers";
import { portefolje } from "./data";

// Valgt rådgiver lagres i en cookie, så serveren kan vise riktig portefølje. Standard er Hanne.
// Dette er et demovalg, ikke innlogging eller tilgangsstyring: alle kunder kan fortsatt åpnes.
export const RADGIVER_COOKIE = "radgiver";

export async function valgtRadgiver(): Promise<string> {
  const verdi = (await cookies()).get(RADGIVER_COOKIE)?.value;
  return verdi && portefolje.radgivere.includes(verdi) ? verdi : portefolje.radgiver;
}

export async function mineKunder() {
  const radgiver = await valgtRadgiver();
  return { radgiver, kunder: portefolje.kunder.filter((k) => k.radgiver === radgiver) };
}
