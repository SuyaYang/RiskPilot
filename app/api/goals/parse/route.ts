import { NextResponse } from "next/server";
import { parseGoal } from "@/lib/ai";
import { iso, today } from "@/lib/dates";

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({}));
  if (!text || String(text).length > 300) return NextResponse.json({ error: "Describe your goal in one sentence" }, { status: 400 });
  const draft = await parseGoal(String(text), iso(today()));
  if (!draft) return NextResponse.json({ error: "Couldn't read that goal. Please fill in the form instead." }, { status: 422 });
  return NextResponse.json({ draft });
}
