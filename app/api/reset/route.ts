import { NextResponse } from "next/server";
import { reset } from "@/lib/store";
import { currentPersonaId } from "@/lib/state";
import { demoEnabled } from "@/lib/checkout";
export async function POST() {
  if (!demoEnabled()) return NextResponse.json({ error: "Demo reset disabled" }, { status: 404 });
  try { reset(await currentPersonaId()); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 409 }); }
}
