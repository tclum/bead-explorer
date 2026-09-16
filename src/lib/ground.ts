import Anthropic from "@anthropic-ai/sdk";
import { retrieve } from "./retrieve";
import { verifyCitations, numbersCovered, extractNumbers, sanitizeRefusalReason, withholdUncoveredSentences } from "./verify";
import type { Citation, DroppedCitation, GroundedResult, RetrievedChunk, Usage, VerifiedCitation } from "./types";

const K_DEFAULT = 20;
const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `You answer questions about the State of Hawaiʻi's BEAD (Broadband Equity, Access, and Deployment) program using ONLY the passages provided in the user message. Rules:
1. Use no outside knowledge. If the passages do not contain the specific fact the question asks for, refuse: set refused=true, answer="", citations=[], and put a one-sentence generic-cover-summary in refusal_reason. Do not put an explanation in the answer field; do not hedge by offering related-but-different facts (e.g., "planned" or "contracted" when the question asks "so far" or "completed"). Refusing is a correct outcome, never a failure.
2. Every factual claim in the answer must be supported by a citation. A citation's quote must be at most one sentence and at most 150 characters, and must be copied from the passage EXACTLY as it appears — including any typos, odd spacing, or unusual punctuation. Never correct or clean up passage text inside a quote. Several short quotes beat one long quote.
3. Answer in plain language, two to four sentences, with the key numbers, dates, and names stated explicitly. Do not editorialize.
4. If passages disagree, say so and cite both.
5. Never name any company, product, or organization that does not appear in the passages.
6. Every number, date, dollar amount, and percentage you state must appear inside one of your citation quotes, copied exactly; prefer quoting the line that carries the figure.
7. When reporting a breakdown, keep the source's categories and labels exactly as listed; never nest, combine, or infer relationships between figures.
8. Refer to source documents by name only (e.g., "the Final Proposal", "the Challenge Process Guide"). Do NOT include document identifiers or version numbers (like "Volume 1", "Vol. 2", "v1.2", "Section 3", "page 5") in the answer, unless the question specifically asks about them.
9. Answer the question asked; do not enumerate breakdowns, sub-totals, or lists unless the question asks for them.
10. Provide at most six citations.

Citation guidance: for each distinct figure you plan to state, supply a citation whose quote is at most one sentence and at most 150 characters copied verbatim from a passage and includes that figure. Prefer several short quotes over one long quote. Copy the passage text exactly as displayed — including typos and odd spacing — never correcting it. For lists and bullet points, quote one list item per citation, exactly as printed, including the bullet character if it is part of the line. It is fine to include multiple citations. If two figures both appear in one short span, one citation for that span covers both. Do not paraphrase inside a quote.`;

const TOOL_DEFINITION = {
  name: "grounded_answer",
  description:
    "Return the grounded answer. Every claim in `answer` must be supported by at least one citation whose `quote` is copied verbatim from the cited passage. If the passages do not answer the question, set `refused` to true, leave `citations` empty, and say briefly what the corpus does cover.",
  input_schema: {
    type: "object" as const,
    properties: {
      answer: { type: "string" },
      refused: { type: "boolean" },
      refusal_reason: { type: "string" },
      citations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            passage_id: { type: "string" },
            quote: { type: "string" },
          },
          required: ["passage_id", "quote"],
        },
      },
    },
    required: ["answer", "refused", "citations"],
  },
};

function buildUserBlocks(question: string, retrieved: RetrievedChunk[]): Anthropic.Messages.TextBlockParam[] {
  const blocks: Anthropic.Messages.TextBlockParam[] = [];
  blocks.push({ type: "text", text: `${question}\n\n<passages>` });
  for (let i = 0; i < retrieved.length; i += 1) {
    const r = retrieved[i];
    const isLast = i === retrieved.length - 1;
    const passage = `<passage id="${r.id}" doc="${r.doc}" page="${r.page}">${r.text}</passage>`;
    const block: Anthropic.Messages.TextBlockParam = { type: "text", text: passage };
    if (isLast) block.cache_control = { type: "ephemeral" };
    blocks.push(block);
  }
  blocks.push({ type: "text", text: `</passages>` });
  return blocks;
}

const SYSTEM_BLOCKS: Anthropic.Messages.TextBlockParam[] = [
  { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
];

function usageFrom(m: Anthropic.Messages.Message): Usage {
  const u = m.usage;
  return {
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
  };
}

function addUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_creation_input_tokens: a.cache_creation_input_tokens + b.cache_creation_input_tokens,
    cache_read_input_tokens: a.cache_read_input_tokens + b.cache_read_input_tokens,
  };
}

type ToolInput = {
  answer: string;
  refused: boolean;
  refusal_reason?: string;
  citations?: Citation[];
};

type ToolCall = { id: string; input: ToolInput };

function extractToolCall(message: Anthropic.Messages.Message): ToolCall | null {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === "grounded_answer") {
      return { id: block.id, input: block.input as ToolInput };
    }
  }
  return null;
}

function normalizeParsed(parsed: ToolInput | null): {
  answer: string;
  refused: boolean;
  refusal_reason?: string;
  citations: Citation[];
} {
  return {
    answer: parsed?.answer ?? "",
    refused: Boolean(parsed?.refused),
    refusal_reason: parsed?.refusal_reason,
    citations: Array.isArray(parsed?.citations) ? parsed!.citations : [],
  };
}

function isNumberSubset(subset: string[], superset: string[]): boolean {
  const s = new Set(superset);
  for (const n of subset) if (!s.has(n)) return false;
  return true;
}

export async function askGrounded(
  question: string,
  opts?: { k?: number; client?: Anthropic; model?: string },
): Promise<GroundedResult> {
  const k = opts?.k ?? K_DEFAULT;
  const model = opts?.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = opts?.client ?? new Anthropic();

  const started = Date.now();
  const retrieved = retrieve(question, k);
  const userBlocks = buildUserBlocks(question, retrieved);

  const firstResponse = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_BLOCKS,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "grounded_answer" },
    messages: [{ role: "user", content: userBlocks }],
  });

  let usage: Usage = usageFrom(firstResponse);

  const firstCall = extractToolCall(firstResponse);
  const firstParsed = normalizeParsed(firstCall?.input ?? null);
  let answer = firstParsed.answer;
  let refused = firstParsed.refused;
  let refusal_reason = firstParsed.refusal_reason;
  let citations: Citation[] = firstParsed.citations;

  let verification = verifyCitations(citations, retrieved);
  let verified: VerifiedCitation[] = verification.verified;
  let dropped: DroppedCitation[] = verification.dropped;
  let retried = false;
  let answer_revised = false;
  let uncovered: string[] = [];

  const initialAllDropped =
    !refused && citations.length > 0 && verified.length === 0;
  const coverage = !refused ? numbersCovered(answer, verified.map((v) => v.quote)) : { uncovered: [] };

  if (!refused && firstCall && (initialAllDropped || coverage.uncovered.length > 0)) {
    retried = true;
    const followUp = initialAllDropped
      ? `None of your citation quotes appears verbatim in the passages you were given. You may remove any figure you cannot cite verbatim; you may not add new figures or new claims. Please provide citations whose 'quote' field is copied EXACTLY, character-for-character, from one of the passages (each quote at most one sentence, at most 150 characters). Return the answer again with verified citations.`
      : (() => {
          const hints = coverage.uncovered.map((n) => {
            const canonicalRe = new RegExp(`(?<![\\d.])${n.replace(/\./g, "\\.")}(?![\\d.])`);
            const passages = retrieved
              .filter((r) => canonicalRe.test(r.text.replace(/,/g, "")))
              .map((r) => r.id);
            return passages.length > 0
              ? `${n} appears in: ${passages.slice(0, 4).join(", ")}`
              : `${n} appears in none of the passages`;
          });
          return `These figures in your previous answer are not yet in any of your citation quotes: ${coverage.uncovered.join(", ")}.\n\nYou may remove any figure you cannot cite verbatim; you may not add new figures or new claims. For each figure you keep, add a NEW citation entry to your citations array whose 'quote' is at most one sentence and at most 150 characters, copied EXACTLY from a passage, and which contains that specific figure. Do not remove or edit previous citations that were already verified. Return the (possibly revised) answer and the complete list of citations (previous + new).\n\nHints from the passages you were given:\n${hints.join("\n")}`;
        })();

    const secondResponse = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_BLOCKS,
      tools: [TOOL_DEFINITION],
      tool_choice: { type: "tool", name: "grounded_answer" },
      messages: [
        { role: "user", content: userBlocks },
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: firstCall.id,
              name: "grounded_answer",
              input: firstCall.input as unknown as Record<string, unknown>,
            },
          ],
        },
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: firstCall.id, content: "ok" },
            { type: "text", text: followUp },
          ],
        },
      ],
    });
    usage = addUsage(usage, usageFrom(secondResponse));

    const secondCall = extractToolCall(secondResponse);
    const secondParsed = normalizeParsed(secondCall?.input ?? null);

    // Merge citations from both turns and re-verify.
    const mergedMap = new Map<string, Citation>();
    for (const c of firstParsed.citations) mergedMap.set(`${c.passage_id}||${c.quote}`, c);
    for (const c of secondParsed.citations) mergedMap.set(`${c.passage_id}||${c.quote}`, c);
    citations = Array.from(mergedMap.values());
    verification = verifyCitations(citations, retrieved);
    verified = verification.verified;
    dropped = verification.dropped;

    // Subset rule: accept the retry's answer iff (a) it is not refused,
    // (b) its numbers are a subset of the first-turn's, and (c) every
    // remaining figure is covered by a verified quote. Otherwise keep the
    // first-turn answer and let the existing coverage check refuse below.
    const retryNumbers = extractNumbers(secondParsed.answer);
    const firstNumbers = extractNumbers(firstParsed.answer);
    const retryCoverage = numbersCovered(secondParsed.answer, verified.map((v) => v.quote));
    if (
      !secondParsed.refused &&
      secondParsed.answer.length > 0 &&
      isNumberSubset(retryNumbers, firstNumbers) &&
      retryCoverage.uncovered.length === 0
    ) {
      if (secondParsed.answer !== firstParsed.answer) answer_revised = true;
      answer = secondParsed.answer;
    }
  }

  if (!refused && verified.length === 0) {
    refused = true;
    refusal_reason = "ungrounded: no citation could be verified against the retrieved passages";
  }

  let withheld_count = 0;
  let withheld_sentences: string[] = [];
  if (!refused) {
    // Withhold instead of refuse: prune sentences whose figures lack a
    // verified receipt. If nothing survives, refuse.
    const pruned = withholdUncoveredSentences(answer, verified.map((v) => v.quote));
    answer = pruned.answer;
    withheld_count = pruned.withheld_count;
    withheld_sentences = pruned.withheld_sentences;
    uncovered = pruned.uncovered_after;
    if (answer.length === 0) {
      refused = true;
      refusal_reason = "ungrounded: no verifiable content remains after withholding uncovered figures";
    }
  }

  // Refusals are figure-free by construction: no answer text, no citations,
  // and a refusal_reason that carries no numbers. Withheld sentences are
  // also cleared on refusal so nothing leaks through refusal_reason.
  if (refused) {
    answer = "";
    verified = [];
    withheld_sentences = [];
    withheld_count = 0;
    refusal_reason = sanitizeRefusalReason(refusal_reason);
  }

  const result: GroundedResult = {
    question,
    answer,
    refused,
    citations: verified,
    dropped,
    dropped_citations: dropped.length,
    retrieved: retrieved.map((r) => ({ id: r.id, doc: r.doc, page: r.page, score: r.score })),
    model,
    latency_ms: Date.now() - started,
    retried,
    answer_revised,
    uncovered_numbers: uncovered,
    withheld_count,
    withheld_sentences,
    usage,
  };
  if (refusal_reason) result.refusal_reason = refusal_reason;
  return result;
}
