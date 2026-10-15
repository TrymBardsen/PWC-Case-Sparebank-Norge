import { NextResponse } from "next/server";
import { status } from "@/lib/kiKo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const jobbId = new URL(req.url).searchParams.get("jobb") ?? "";
  const s = status(jobbId);
  return NextResponse.json(s, { status: s.status === "ukjent" ? 404 : 200 });
}
