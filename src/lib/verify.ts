import type { Citation, DroppedCitation, RetrievedChunk, VerifiedCitation } from "./types";
import { normalize } from "./normalize";

const MIN_NORMALIZED_QUOTE = 15;
const SEGMENT_JOIN = " … ";

// Split on: newlines (any), bullet characters, or " - "/" – " when
// followed by a word start. Sentence boundaries are handled inside
// splitQuoteSegments as a second pass so that a bullet or newline
// splits regardless of surrounding punctuation.
const PRIMARY_BOUNDARY = /[\n\r]+|[●•○▪]/;
const LEADING_DASH = /^[-–]\s+/;
const SENTENCE_BOUNDARY = /(?<=[.;?!])\s+(?=["“(\[]?[A-ZÀ-ÖØ-Þ])/u;

export function splitQuoteSegments(quote: string): string[] {
  const segments: string[] = [];
  for (const primary of quote.split(PRIMARY_BOUNDARY)) {
    const stripped = primary.trim().replace(LEADING_DASH, "").trim();
    if (stripped.length === 0) continue;
    for (const s of stripped.split(SENTENCE_BOUNDARY)) {
      const t = s.trim();
      if (t.length > 0) segments.push(t);
    }
  }
  return segments;
}

type SegmentMatch = {
  chunk: RetrievedChunk;
  matched: string[];
  retrievalIndex: number;
};

function bestSegmentMatch(quote: string, retrieved: RetrievedChunk[]): SegmentMatch | null {
  const segments = splitQuoteSegments(quote);
  if (segments.length === 0) return null;
  let best: SegmentMatch | null = null;
  for (let ri = 0; ri < retrieved.length; ri += 1) {
    const c = retrieved[ri];
    const nText = normalize(c.text);
    const matched: string[] = [];
    for (const seg of segments) {
      const nSeg = normalize(seg);
      if (nSeg.length < MIN_NORMALIZED_QUOTE) continue;
      if (nText.includes(nSeg)) matched.push(seg);
    }
    if (matched.length === 0) continue;
    if (
      best === null ||
      matched.length > best.matched.length ||
      (matched.length === best.matched.length && ri < best.retrievalIndex)
    ) {
      best = { chunk: c, matched, retrievalIndex: ri };
    }
  }
  return best;
}

export function verifyCitations(
  citations: Citation[],
  retrieved: RetrievedChunk[],
): { verified: VerifiedCitation[]; dropped: DroppedCitation[] } {
  const byId = new Map<string, RetrievedChunk>();
  for (const r of retrieved) byId.set(r.id, r);
  const verified: VerifiedCitation[] = [];
  const dropped: DroppedCitation[] = [];

  for (const c of citations) {
    const nq = normalize(c.quote);
    if (nq.length < MIN_NORMALIZED_QUOTE) {
      dropped.push({ passage_id: c.passage_id, quote: c.quote, reason: "too_short" });
      continue;
    }
    const original = byId.get(c.passage_id);
    if (original && normalize(original.text).includes(nq)) {
      verified.push({
        passage_id: c.passage_id,
        quote: c.quote,
        doc: original.doc,
        page: original.page,
        url: original.url,
        page_url: original.page_url,
        reattributed: false,
        trimmed: false,
      });
      continue;
    }
    // Multi-match re-attribution: first retrieved chunk in retrieval order
    // whose text contains the full quote.
    const altIndex = retrieved.findIndex(
      (r) => r.id !== c.passage_id && normalize(r.text).includes(nq),
    );
    if (altIndex >= 0) {
      const alt = retrieved[altIndex];
      verified.push({
        passage_id: alt.id,
        quote: c.quote,
        doc: alt.doc,
        page: alt.page,
        url: alt.url,
        page_url: alt.page_url,
        reattributed: true,
        trimmed: false,
      });
      continue;
    }
    // Segment-level verification: split the quote on sentence and list-item
    // boundaries, verify each segment (≥15 normalized chars) against each
    // retrieved chunk, and pick the chunk with the most matching segments
    // (ties: retrieval order). Keep the matched segments in original order,
    // joined by " … ".
    const trim = bestSegmentMatch(c.quote, retrieved);
    if (trim !== null) {
      verified.push({
        passage_id: trim.chunk.id,
        quote: trim.matched.join(SEGMENT_JOIN),
        doc: trim.chunk.doc,
        page: trim.chunk.page,
        url: trim.chunk.url,
        page_url: trim.chunk.page_url,
        reattributed: trim.chunk.id !== c.passage_id,
        trimmed: true,
      });
      continue;
    }
    dropped.push({ passage_id: c.passage_id, quote: c.quote, reason: "not_found" });
  }
  return { verified, dropped };
}

const NUMBER_RE = /\d+(?:,\d{3})*(?:\.\d+)?/g;

export function extractNumbers(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    out.push(m[0].replace(/,/g, ""));
  }
  return out;
}

export function numbersCovered(answer: string, quotes: string[]): { uncovered: string[] } {
  const answerNumbers = Array.from(new Set(extractNumbers(answer)));
  const combined = quotes.join(" ").replace(/,/g, "");
  const uncovered: string[] = [];
  for (const n of answerNumbers) {
    const escaped = n.replace(/\./g, "\\.");
    const re = new RegExp(`(?<![\\d.])${escaped}(?![\\d.])`);
    if (!re.test(combined)) uncovered.push(n);
  }
  return { uncovered };
}

// Same sentence-boundary regex as the chunker: split on `. ; ? !` +
// whitespace + a leading capital / opening quote / bracket, so common
// abbreviations ("No. 23") don't split. Used to prune whole sentences
// whose figures have no verified receipt.
const ANSWER_SENTENCE_BOUNDARY = /(?<=[.;?!])\s+(?=["“(\[]?[A-ZÀ-ÖØ-Þ])/u;

export function splitAnswerSentences(answer: string): string[] {
  return answer
    .split(ANSWER_SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function withholdUncoveredSentences(
  answer: string,
  verifiedQuotes: string[],
): {
  answer: string;
  withheld_sentences: string[];
  withheld_count: number;
  uncovered_after: string[];
} {
  const initialCoverage = numbersCovered(answer, verifiedQuotes);
  if (initialCoverage.uncovered.length === 0) {
    return { answer, withheld_sentences: [], withheld_count: 0, uncovered_after: [] };
  }
  const uncoveredSet = new Set(initialCoverage.uncovered);
  const sentences = splitAnswerSentences(answer);
  const kept: string[] = [];
  const withheld: string[] = [];
  for (const sentence of sentences) {
    const sentenceNumbers = extractNumbers(sentence);
    const hasUncovered = sentenceNumbers.some((n) => uncoveredSet.has(n));
    if (hasUncovered) withheld.push(sentence);
    else kept.push(sentence);
  }
  const pruned = kept.join(" ").trim();
  const recomputed = numbersCovered(pruned, verifiedQuotes);
  return {
    answer: pruned,
    withheld_sentences: withheld,
    withheld_count: withheld.length,
    uncovered_after: recomputed.uncovered,
  };
}

export const GENERIC_REFUSAL =
  "The loaded documents don't contain an answer to this question. They cover Hawaiʻi's BEAD Initial and Final Proposals, the challenge process, NTIA's approval, and the state's deployment announcement.";

export function sanitizeRefusalReason(reason: string | undefined): string {
  if (!reason) return GENERIC_REFUSAL;
  if (extractNumbers(reason).length > 0) return GENERIC_REFUSAL;
  return reason;
}
