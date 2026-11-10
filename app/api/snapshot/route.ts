import { NextResponse } from "next/server";
import { currentPersonaId, snapshot } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(snapshot(await currentPersonaId()));
}
