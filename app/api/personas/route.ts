import { NextResponse } from "next/server";
import { buildPersonas } from "@/lib/personas";
import { currentPersonaId, PERSONA_COOKIE } from "@/lib/state";

export async function GET() {
  const active = await currentPersonaId();
  return NextResponse.json({
    active,
    personas: buildPersonas().map((p) => ({ id: p.id, name: p.name, tagline: p.tagline })),
  });
}

export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (!buildPersonas().some((p) => p.id === id)) return NextResponse.json({ error: "Unknown persona" }, { status: 400 });
  const res = NextResponse.json({ active: id });
  res.cookies.set(PERSONA_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
