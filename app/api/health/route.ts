import { NextResponse } from "next/server";
export async function GET() { return NextResponse.json({ status: "ok", mode: "fictional-demo", schemaVersion: "rp-v1" }); }
