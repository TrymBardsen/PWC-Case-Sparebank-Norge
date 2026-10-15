import { NextResponse } from "next/server";
import { sokEnheter } from "@/lib/brreg";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ treff: [] });
  return NextResponse.json({ treff: await sokEnheter(q) });
}
