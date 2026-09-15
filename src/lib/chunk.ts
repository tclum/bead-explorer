import type { Chunk } from "./types";

const MAX_PAYLOAD = 1200;
const OVERLAP_CARRY_MAX = 240;
const MIN_CHUNK_CHARS = 40;
export const MAX_CHUNK_CHARS = MAX_PAYLOAD + OVERLAP_CARRY_MAX; // 1440

export type PageInput = { doc: string; page: number; text: string; url: string; page_url: string };

function normaliseWhitespace(s: string): string {
  return s.replace(/[ \t\f\v]+/g, " ").trim();
}

function splitUnits(pageText: string): string[] {
  const byBlank = pageText
    .split(/\n{2,}|\r\n\r\n/)
    .map(normaliseWhitespace)
    .filter((p) => p.length > 0);
  const seed = byBlank.length > 1 ? byBlank : pageText
    .split(/\r?\n/)
    .map(normaliseWhitespace)
    .filter((p) => p.length > 0);
  const out: string[] = [];
  for (const p of seed) {
    if (p.length <= MAX_PAYLOAD) {
      out.push(p);
      continue;
    }
    out.push(...subSplitParagraph(p));
  }
  return out;
}

function subSplitParagraph(p: string): string[] {
  // Split on sentence boundaries: ". ", "; ", "? ", "! " (keep the punctuation with the left half) or a newline.
  const parts = p.split(/(?<=[.;?!])\s+|\n+/);
  const sentences: string[] = [];
  for (const raw of parts) {
    const s = raw.trim();
    if (s.length === 0) continue;
    if (s.length <= MAX_PAYLOAD) {
      sentences.push(s);
    } else {
      // Hard-split at MAX_PAYLOAD when a single sentence is longer.
      for (let i = 0; i < s.length; i += MAX_PAYLOAD) {
        sentences.push(s.slice(i, i + MAX_PAYLOAD));
      }
    }
  }
  // Greedy-pack sentences into ≤MAX_PAYLOAD pieces.
  const pieces: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur.length === 0) {
      cur = s;
      continue;
    }
    const candidate = cur + " " + s;
    if (candidate.length <= MAX_PAYLOAD) {
      cur = candidate;
    } else {
      pieces.push(cur);
      cur = s;
    }
  }
  if (cur.length > 0) pieces.push(cur);
  return pieces;
}

export function chunkPage(input: PageInput): Chunk[] {
  const units = splitUnits(input.text);
  const chunks: Chunk[] = [];
  let n = 0;
  let payload = "";
  let pendingCarry = "";

  const buildChunk = () => {
    if (payload.length < MIN_CHUNK_CHARS) {
      // Update carry from the (short) payload's last unit anyway, so we don't lose context.
      const lastUnit = payload.split(/\n{2,}/).pop() ?? "";
      pendingCarry = lastUnit.length > 0 && lastUnit.length <= OVERLAP_CARRY_MAX ? lastUnit : pendingCarry;
      payload = "";
      return;
    }
    const text = pendingCarry.length > 0 ? pendingCarry + "\n\n" + payload : payload;
    n += 1;
    chunks.push({
      id: `${input.doc}:p${input.page}:${n}`,
      doc: input.doc,
      page: input.page,
      text,
      url: input.url,
      page_url: input.page_url,
    });
    const lastUnit = payload.split(/\n{2,}/).pop() ?? "";
    pendingCarry = lastUnit.length > 0 && lastUnit.length <= OVERLAP_CARRY_MAX ? lastUnit : "";
    payload = "";
  };

  for (const u of units) {
    if (payload.length === 0) {
      payload = u;
      continue;
    }
    const candidate = payload + "\n\n" + u;
    if (candidate.length <= MAX_PAYLOAD) {
      payload = candidate;
    } else {
      buildChunk();
      payload = u;
    }
  }
  buildChunk();
  return chunks;
}

export function chunkPages(pages: PageInput[]): Chunk[] {
  const out: Chunk[] = [];
  for (const p of pages) out.push(...chunkPage(p));
  return out;
}
