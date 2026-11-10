import { NextResponse } from "next/server";
import { conceptAnswer } from "@/lib/ai";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const answer = conceptAnswer(id);
  if (!answer) return NextResponse.json({ error: "Unknown question" }, { status: 404 });
  return NextResponse.json({ answer });
}
