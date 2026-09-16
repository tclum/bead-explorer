import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SHA = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "dev";
const BUILT_AT = new Date().toISOString();

export async function GET() {
  return NextResponse.json({ sha: SHA, built_at: BUILT_AT });
}
