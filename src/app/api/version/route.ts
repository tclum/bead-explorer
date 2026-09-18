import { NextResponse } from "next/server";
import { BUILD_SHA } from "@/lib/build";

export const runtime = "nodejs";

const BUILT_AT = new Date().toISOString();

export async function GET() {
  return NextResponse.json({ sha: BUILD_SHA, built_at: BUILT_AT });
}
