import { readFileSync } from "node:fs";
import path from "node:path";
import MiniSearch from "minisearch";
import type { Corpus, Chunk, RetrievedChunk } from "./types";
import { normalize } from "./normalize";

type Doc = {
  id: string;
  text: string;
  doc: string;
  page: number;
  url: string;
  page_url: string;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "does",
  "did",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "how",
  "i",
  "in",
  "is",
  "it",
  "its",
  "many",
  "much",
  "not",
  "of",
  "on",
  "or",
  "she",
  "so",
  "such",
  "that",
  "the",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "you",
]);

const CANDIDATE_POOL_MULTIPLIER = 6;
const PER_DOC_PENALTY = 0.35;

let cached: { index: MiniSearch<Doc>; byId: Map<string, Doc> } | null = null;

function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[^\p{L}\p{N}$%]+/u)
    .filter((t) => t.length > 0);
}

function buildIndex(): { index: MiniSearch<Doc>; byId: Map<string, Doc> } {
  const corpusPath = path.join(process.cwd(), "data", "corpus.json");
  const raw = readFileSync(corpusPath, "utf8");
  const corpus = JSON.parse(raw) as Corpus;
  const docs: Doc[] = corpus.chunks.map((c: Chunk) => ({
    id: c.id,
    text: c.text,
    doc: c.doc,
    page: c.page,
    url: c.url,
    page_url: c.page_url,
  }));
  const index = new MiniSearch<Doc>({
    fields: ["text"],
    storeFields: ["doc", "page", "url", "page_url", "text"],
    processTerm: (term) => {
      const n = normalize(term);
      if (n.length < 2) return null;
      if (STOP_WORDS.has(n)) return null;
      return n;
    },
    tokenize,
  });
  index.addAll(docs);
  const byId = new Map<string, Doc>();
  for (const d of docs) byId.set(d.id, d);
  return { index, byId };
}

function getIndex(): { index: MiniSearch<Doc>; byId: Map<string, Doc> } {
  if (cached === null) cached = buildIndex();
  return cached;
}

type Candidate = { item: RetrievedChunk; score: number };

export function retrieve(question: string, k: number = 8): RetrievedChunk[] {
  const { index, byId } = getIndex();
  const rawResults = index.search(question, {
    prefix: true,
    fuzzy: 0.15,
    combineWith: "OR",
  });
  const pool: Candidate[] = rawResults
    .slice()
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)))
    .slice(0, Math.max(k * CANDIDATE_POOL_MULTIPLIER, k))
    .map((r) => {
      const d = byId.get(String(r.id));
      if (!d) return null;
      const item: RetrievedChunk = {
        id: d.id,
        doc: d.doc,
        page: d.page,
        score: r.score,
        text: d.text,
        url: d.url,
        page_url: d.page_url,
      };
      return { item, score: r.score };
    })
    .filter((c): c is Candidate => c !== null);

  const perDoc = new Map<string, number>();
  const kept: RetrievedChunk[] = [];
  const remaining = new Set(pool);
  while (kept.length < k && remaining.size > 0) {
    let best: Candidate | null = null;
    let bestScore = -Infinity;
    for (const c of remaining) {
      const count = perDoc.get(c.item.doc) ?? 0;
      const effective = c.score / (1 + PER_DOC_PENALTY * count);
      if (
        effective > bestScore ||
        (effective === bestScore && best !== null && c.item.id.localeCompare(best.item.id) < 0)
      ) {
        best = c;
        bestScore = effective;
      }
    }
    if (best === null) break;
    remaining.delete(best);
    perDoc.set(best.item.doc, (perDoc.get(best.item.doc) ?? 0) + 1);
    kept.push(best.item);
  }
  return kept;
}

export function resetRetrieveCacheForTests() {
  cached = null;
}
