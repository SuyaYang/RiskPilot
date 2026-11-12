import { NextResponse } from "next/server";
import { load } from "@/lib/store";
import { currentPersonaId } from "@/lib/state";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = load().decisions[id];
  if (!d || d.personaId !== (await currentPersonaId())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ decision: d });
}
