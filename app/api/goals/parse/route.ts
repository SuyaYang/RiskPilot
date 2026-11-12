import { NextResponse } from "next/server";
import { parseGoal } from "@/lib/ai";
import { iso, today } from "@/lib/dates";

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({}));
  if (!text || String(text).length > 300) return NextResponse.json({ error: "Describe your goal in one sentence" }, { status: 400 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Gemini is not configured yet. Add GEMINI_API_KEY to the server environment and restart the app, or fill in the form." }, { status: 503 });
  const draft = await parseGoal(String(text), iso(today()));
  if (!draft) return NextResponse.json({ error: "Couldn't read that goal. Please fill in the form instead." }, { status: 422 });
  return NextResponse.json({ draft });
}
