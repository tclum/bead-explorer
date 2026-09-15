import type { Citation, RetrievedChunk, VerifiedCitation } from "./types";
import { normalize } from "./normalize";

const MIN_NORMALIZED_QUOTE = 15;

export function verifyCitations(
  citations: Citation[],
  retrieved: RetrievedChunk[],
): { verified: VerifiedCitation[]; dropped: number } {
  const byId = new Map<string, RetrievedChunk>();
  for (const r of retrieved) byId.set(r.id, r);
  const verified: VerifiedCitation[] = [];
  let dropped = 0;

  for (const c of citations) {
    const nq = normalize(c.quote);
    if (nq.length < MIN_NORMALIZED_QUOTE) {
      dropped += 1;
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
      });
      continue;
    }
    const others = retrieved.filter((r) => r.id !== c.passage_id && normalize(r.text).includes(nq));
    if (others.length === 1) {
      const alt = others[0];
      verified.push({
        passage_id: alt.id,
        quote: c.quote,
        doc: alt.doc,
        page: alt.page,
        url: alt.url,
        page_url: alt.page_url,
        reattributed: true,
      });
      continue;
    }
    dropped += 1;
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
