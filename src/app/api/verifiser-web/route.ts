import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normaliser, type Sitatstatus } from "@/lib/rapport";
import { privatAdresse } from "@/lib/nettadresse";
import { lesJson } from "@/lib/api";

// Henter nettkildene fra rapporten og sjekker at sitatet står i artikkelen.
// Bare https mot offentlige adresser (ingen localhost eller private nett), også etter
// videresendinger. Begrensning: DNS slås opp på nytt av fetch, så en ondsinnet DNS-tjener
// kan i teorien svare forskjellig mellom kontroll og henting (DNS rebinding).

const Foresporsel = z.object({
  kilder: z.array(z.object({ id: z.string().max(10), url: z.string().url().max(2000), sitat: z.string().max(1000) })).max(6),
});

const MAKS_BYTE = 2_000_000;
const MAKS_VIDERESENDINGER = 3;

async function trygg(url: URL): Promise<boolean> {
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const vert = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(vert)) return !privatAdresse(vert);
  try {
    const adresser = await lookup(vert, { all: true });
    return adresser.length > 0 && adresser.every((a) => !privatAdresse(a.address));
  } catch {
    return false;
  }
}

// Følger videresendinger manuelt, så hvert mål kontrolleres før det hentes
async function hentTrygt(start: URL): Promise<Response | null> {
  let url = start;
  for (let i = 0; i <= MAKS_VIDERESENDINGER; i++) {
    if (!(await trygg(url))) return null;
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(7000), headers: { "User-Agent": "Mozilla/5.0 Likviditetsradaren-kildekontroll" } });
    if (res.status >= 300 && res.status < 400) {
      const neste = res.headers.get("location");
      if (!neste) return null;
      url = new URL(neste, url);
      continue;
    }
    return res;
  }
  return null;
}

async function lesBegrenset(res: Response): Promise<string> {
  const leser = res.body?.getReader();
  if (!leser) return "";
  const deler: Uint8Array[] = [];
  let lengde = 0;
  while (lengde < MAKS_BYTE) {
    const { done, value } = await leser.read();
    if (done) break;
    deler.push(value);
    lengde += value.length;
  }
  await leser.cancel().catch(() => undefined);
  const samlet = new Uint8Array(lengde);
  let pos = 0;
  for (const d of deler) {
    samlet.set(d, pos);
    pos += d.length;
  }
  return new TextDecoder().decode(samlet.slice(0, MAKS_BYTE));
}

// Navngitte entiteter som er vanlige på norske nettsider (f.eks. Norges Bank skriver «&aring;»)
const ENTITETER: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">",
  aring: "å", Aring: "Å", oslash: "ø", Oslash: "Ø", aelig: "æ", AElig: "Æ",
  eacute: "é", Eacute: "É", auml: "ä", ouml: "ö", uuml: "ü",
  ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", shy: "",
};

function tekstFraHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (_, n) => ENTITETER[n] ?? " ");
}

async function sjekk(kilde: { id: string; url: string; sitat: string }): Promise<Sitatstatus> {
  try {
    const res = await hentTrygt(new URL(kilde.url));
    if (!res?.ok) return "kunne ikke hentes";
    const type = res.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) return "kunne ikke hentes";
    const html = await lesBegrenset(res);
    const tekst = normaliser(tekstFraHtml(html));
    const sitat = normaliser(kilde.sitat);
    // Godtar treff på hele sitatet, eller på de første 12 ordene ved lange sitater
    const start = sitat.split(" ").slice(0, 12).join(" ");
    return tekst.includes(sitat) || (start.length > 30 && tekst.includes(start)) ? "verifisert" : "ikke funnet";
  } catch {
    return "kunne ikke hentes";
  }
}

export async function POST(req: Request) {
  const tolket = await lesJson(req, Foresporsel, 50_000);
  if (!tolket.ok) return tolket.svar;
  const resultat = await Promise.all(tolket.data.kilder.map(async (k) => [k.id, await sjekk(k)] as const));
  return NextResponse.json({ status: Object.fromEntries(resultat) });
}
