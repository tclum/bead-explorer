import type { Chunk } from "./types";

const MAX_PAYLOAD = 1200;
const OVERLAP_CARRY_MAX = 240;
const MIN_CHUNK_CHARS = 40;
export const MAX_CHUNK_CHARS = MAX_PAYLOAD + OVERLAP_CARRY_MAX; // 1440

const SENTENCE_BOUNDARY = /(?<=[.;?!])\s+(?=["“(\[]?[A-ZÀ-ÖØ-Þ])/u;
const FOLIO_LINE = /^(?:page\s+)?\d{1,4}(?:\s*of\s*\d{1,4})?$/i;
const TERMINAL_PUNCT_RE = /[.:;?!)"%]$/;

export type PageInput = { doc: string; page: number; text: string; url: string; page_url: string };

function normaliseWhitespace(s: string): string {
  return s.replace(/[ \t\f\v]+/g, " ").trim();
}

function endsInTerminalPunct(s: string): boolean {
  return /[.:;?!)]$/.test(s);
}

function startsWithParaMarker(s: string): boolean {
  if (s.length === 0) return false;
  const c0 = s.charAt(0);
  if (/[A-ZÀ-ÖØ-Þ]/.test(c0)) return true;
  if (c0 === "●" || c0 === "•" || c0 === "○" || c0 === "-") return true;
  if (/^\d+[.)]/.test(s)) return true;
  // Footnote marker / numbered item: <digit(s)> <space> then a footnote body or heading.
  if (/^\d{1,3}\s+/.test(s)) return true;
  return false;
}

function startsWithUpper(s: string): boolean {
  if (s.length === 0) return false;
  return /[A-ZÀ-ÖØ-Þ]/.test(s.charAt(0));
}

function reflowLinesToParagraphs(pageText: string): string[] {
  const lines = pageText
    .split(/\r?\n/)
    .map(normaliseWhitespace)
    .filter((l) => l.length > 0 && !FOLIO_LINE.test(l));
  if (lines.length === 0) return [];
  const paragraphs: string[] = [];
  let cur = "";
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (cur.length === 0) {
      cur = line;
      continue;
    }
    const next = line;
    let paragraphBreak = false;
    if (endsInTerminalPunct(cur) && startsWithParaMarker(next)) {
      paragraphBreak = true;
    } else if (
      cur.length <= 60 &&
      !endsInTerminalPunct(cur) &&
      startsWithUpper(next)
    ) {
      paragraphBreak = true;
    }
    if (paragraphBreak) {
      paragraphs.push(cur);
      cur = next;
      continue;
    }
    if (cur.endsWith("-") && /^[a-zà-öø-ÿ]/.test(next)) {
      cur = cur.slice(0, -1) + next;
    } else {
      cur = cur + " " + next;
    }
  }
  if (cur.length > 0) paragraphs.push(cur);
  return paragraphs;
}

function splitParagraphs(pageText: string): string[] {
  const byBlank = pageText
    .split(/\n{2,}|\r\n\r\n/)
    .map(normaliseWhitespace)
    .filter((p) => p.length > 0);
  if (byBlank.length > 1) return byBlank;
  return reflowLinesToParagraphs(pageText);
}

function splitSentences(paragraph: string): string[] {
  const parts = paragraph.split(SENTENCE_BOUNDARY);
  const out: string[] = [];
  for (const raw of parts) {
    const s = raw.trim();
    if (s.length === 0) continue;
    if (s.length <= MAX_PAYLOAD) {
      out.push(s);
    } else {
      for (let i = 0; i < s.length; i += MAX_PAYLOAD) {
        out.push(s.slice(i, i + MAX_PAYLOAD));
      }
    }
  }
  return out;
}

type Unit = { text: string; paragraphBreakBefore: boolean };

function pageToUnits(pageText: string): Unit[] {
  const paragraphs = splitParagraphs(pageText);
  const units: Unit[] = [];
  for (let pi = 0; pi < paragraphs.length; pi += 1) {
    const sentences = splitSentences(paragraphs[pi]);
    for (let si = 0; si < sentences.length; si += 1) {
      units.push({ text: sentences[si], paragraphBreakBefore: si === 0 && pi > 0 });
    }
  }
  return units;
}

function joinUnits(units: Unit[]): string {
  let out = "";
  for (let i = 0; i < units.length; i += 1) {
    const u = units[i];
    if (i === 0) {
      out = u.text;
      continue;
    }
    out += (u.paragraphBreakBefore ? "\n\n" : " ") + u.text;
  }
  return out;
}

// Return the index i such that bufUnits[0..i] ends at a terminal-punct sentence
// AND bufUnits[i..] would still fit in a chunk starting with those trailing units.
// Returns -1 if no such split point exists that preserves MIN_CHUNK_CHARS on both sides.
function preferredSplit(bufUnits: Unit[]): number {
  if (bufUnits.length <= 1) return -1;
  const last = bufUnits[bufUnits.length - 1];
  if (TERMINAL_PUNCT_RE.test(last.text)) return -1; // already ends well
  // Look for the latest unit ending in terminal punct.
  for (let i = bufUnits.length - 2; i >= 0; i -= 1) {
    if (TERMINAL_PUNCT_RE.test(bufUnits[i].text)) {
      // Ensure the chunk up to i is not below MIN_CHUNK_CHARS.
      const head = joinUnits(bufUnits.slice(0, i + 1));
      if (head.length >= MIN_CHUNK_CHARS) return i + 1;
      return -1;
    }
  }
  return -1;
}

export function chunkPage(input: PageInput): Chunk[] {
  const units = pageToUnits(input.text);
  const chunks: Chunk[] = [];
  if (units.length === 0) return chunks;
  let n = 0;
  let bufUnits: Unit[] = [];
  let carry: Unit | null = null;

  const emitFromSlice = (slice: Unit[]) => {
    const payload = joinUnits(slice);
    if (payload.length < MIN_CHUNK_CHARS) {
      if (slice.length > 0) {
        const last = slice[slice.length - 1];
        if (last.text.length <= OVERLAP_CARRY_MAX) {
          carry = { text: last.text, paragraphBreakBefore: false };
        }
      }
      return;
    }
    const text = carry !== null ? carry.text + "\n\n" + payload : payload;
    n += 1;
    chunks.push({
      id: `${input.doc}:p${input.page}:${n}`,
      doc: input.doc,
      page: input.page,
      text,
      url: input.url,
      page_url: input.page_url,
    });
    const lastInChunk = slice[slice.length - 1];
    carry = lastInChunk.text.length <= OVERLAP_CARRY_MAX
      ? { text: lastInChunk.text, paragraphBreakBefore: false }
      : null;
  };

  const finalize = () => {
    if (bufUnits.length === 0) return;
    // Prefer to end the chunk at a terminal-punct sentence.
    const splitAt = preferredSplit(bufUnits);
    if (splitAt > 0) {
      const head = bufUnits.slice(0, splitAt);
      const tail = bufUnits.slice(splitAt);
      // The tail carries over. Head becomes a paragraph-break-free first unit.
      emitFromSlice(head);
      const firstTail = tail[0];
      bufUnits = [{ text: firstTail.text, paragraphBreakBefore: false }, ...tail.slice(1)];
      return;
    }
    emitFromSlice(bufUnits);
    bufUnits = [];
  };

  const bufLen = (): number => joinUnits(bufUnits).length;

  for (const u of units) {
    if (bufUnits.length === 0) {
      bufUnits = [{ text: u.text, paragraphBreakBefore: false }];
      continue;
    }
    const sep = u.paragraphBreakBefore ? 2 : 1;
    const candidate = bufLen() + sep + u.text.length;
    if (candidate <= MAX_PAYLOAD) {
      bufUnits.push(u);
    } else {
      finalize();
      // After finalize, bufUnits may contain some tail units that were peeled off.
      // If they + this new unit still exceed MAX_PAYLOAD, finalize again with just tail.
      if (bufUnits.length > 0) {
        const sep2 = u.paragraphBreakBefore ? 2 : 1;
        const cand2 = bufLen() + sep2 + u.text.length;
        if (cand2 <= MAX_PAYLOAD) {
          bufUnits.push(u);
        } else {
          // Emit tail as-is, then start new buffer with u.
          emitFromSlice(bufUnits);
          bufUnits = [{ text: u.text, paragraphBreakBefore: false }];
        }
      } else {
        bufUnits = [{ text: u.text, paragraphBreakBefore: false }];
      }
    }
  }
  finalize();
  // If there are still peeled units, emit them.
  if (bufUnits.length > 0) {
    emitFromSlice(bufUnits);
    bufUnits = [];
  }
  return chunks;
}

export function chunkPages(pages: PageInput[]): Chunk[] {
  const out: Chunk[] = [];
  for (const p of pages) out.push(...chunkPage(p));
  return out;
}
