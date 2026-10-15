import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normaliser, type Sitatstatus } from "@/lib/rapport";

// Henter nettkildene fra rapporten og sjekker at sitatet står i artikkelen.
// Bare https mot offentlige adresser (ingen localhost eller private nett).

const Foresporsel = z.object({
  kilder: z.array(z.object({ id: z.string(), url: z.string().url(), sitat: z.string() })).max(6),
});

function privatAdresse(ip: string): boolean {
  if (isIP(ip) === 6) return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80") || ip.startsWith("::ffff:127.");
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function trygg(url: URL): Promise<boolean> {
  if (url.protocol !== "https:") return false;
  if (isIP(url.hostname)) return !privatAdresse(url.hostname);
  try {
    const adresser = await lookup(url.hostname, { all: true });
    return adresser.length > 0 && adresser.every((a) => !privatAdresse(a.address));
  } catch {
    return false;
  }
}

function tekstFraHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, " ");
}

async function sjekk(kilde: { id: string; url: string; sitat: string }): Promise<Sitatstatus> {
  try {
    const url = new URL(kilde.url);
    if (!(await trygg(url))) return "kunne ikke hentes";
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(7000), headers: { "User-Agent": "Mozilla/5.0 Likviditetsradaren-kildekontroll" } });
    if (!res.ok) return "kunne ikke hentes";
    const html = (await res.text()).slice(0, 2_000_000);
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
  const tolket = Foresporsel.safeParse(await req.json());
  if (!tolket.success) return NextResponse.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  const resultat = await Promise.all(tolket.data.kilder.map(async (k) => [k.id, await sjekk(k)] as const));
  return NextResponse.json({ status: Object.fromEntries(resultat) });
}
