import { NextRequest, NextResponse } from "next/server";
import { askGrounded } from "@/lib/ground";

export const runtime = "nodejs";
export const maxDuration = 30;

// Dropped citations reveal quotes the model produced but couldn't verify —
// those quotes may contain hallucinated figures. Digits are masked to `#`
// in the 80-character preview so unverified numbers never leak through
// the API or the UI.
function maskDroppedQuote(quote: string): string {
  return quote.slice(0, 80).replace(/\d/g, "#");
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const buckets = new Map<string, { count: number; windowStart: number }>();

function clientKey(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  if (bucket.count >= MAX_REQUESTS) return true;
  bucket.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "server not configured" }, { status: 503 });
  }
  const key = clientKey(req);
  if (rateLimited(key)) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const raw = (body as { question?: unknown } | null)?.question;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "question must be a string" }, { status: 400 });
  }
  const question = raw.trim();
  if (question.length < 5 || question.length > 300) {
    return NextResponse.json(
      { error: "question length must be 5-300 characters" },
      { status: 400 },
    );
  }
  try {
    const result = await askGrounded(question);
    // The withheld figures themselves must not appear in the API response;
    // clients receive only the count. `withheld_sentences` stays server-only.
    const { withheld_sentences: _withheld, ...safe } = result;
    void _withheld;
    const droppedSafe = safe.dropped.map((d) => ({
      passage_id: d.passage_id,
      reason: d.reason,
      quote: maskDroppedQuote(d.quote),
    }));
    return NextResponse.json({ ...safe, dropped: droppedSafe });
  } catch {
    return NextResponse.json({ error: "upstream model error" }, { status: 502 });
  }
}
