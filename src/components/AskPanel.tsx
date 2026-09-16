"use client";

import { useState } from "react";
import type { GroundedResult } from "@/lib/types";
import Receipts from "./Receipts";

const CHIPS: { id: string; label: string; question: string }[] = [
  { id: "f01", label: "How much did Hawaiʻi get?", question: "How much BEAD funding was Hawaiʻi allocated?" },
  { id: "f03", label: "Challenge process dates", question: "What were the dates of the challenge, rebuttal, and final determination phases of Hawaiʻi's BEAD challenge process?" },
  { id: "f06", label: "Who got the awards?", question: "Which companies received Hawaiʻi's BEAD deployment awards, and how long is each one's period of performance?" },
  { id: "r02", label: "Locations connected so far", question: "How many locations has Hawaiian Telcom connected with BEAD funds so far?" },
];

export default function AskPanel() {
  const [question, setQuestion] = useState<string>("");
  const [result, setResult] = useState<GroundedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  async function submit(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 5 || trimmed.length > 300) {
      setError("Question must be 5–300 characters.");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body?.error ?? `Request failed (${res.status})`);
      } else {
        const body = (await res.json()) as GroundedResult;
        setResult(body);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function applyChip(q: string) {
    setQuestion(q);
    submit(q);
  }

  return (
    <section aria-labelledby="ask-title" className="w-full">
      <h2 id="ask-title" className="mb-3 text-lg font-semibold text-zinc-200">
        Ask
      </h2>
      <div className="rounded border border-zinc-800 bg-zinc-900/60 p-4">
        <textarea
          className="mono w-full resize-y rounded border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          rows={3}
          maxLength={300}
          placeholder="Ask a plain-language question about Hawaiʻi's BEAD program."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
            disabled={loading}
            onClick={() => submit(question)}
          >
            {loading ? "Asking…" : "Ask"}
          </button>
          <span className="text-xs text-zinc-500">{question.trim().length}/300</span>
          <div className="flex flex-wrap gap-2 md:ml-4">
            {CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                onClick={() => applyChip(c.question)}
                disabled={loading}
                title={c.question}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
        {result ? <AnswerCard result={result} /> : null}
      </div>
    </section>
  );
}

function AnswerCard({ result }: { result: GroundedResult }) {
  if (result.refused) {
    return (
      <div className="mt-4 rounded border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-200">
        <div className="font-semibold">Refused</div>
        <div className="mt-1">{result.refusal_reason ?? "The corpus does not answer this question."}</div>
        <div className="mt-1 text-xs text-amber-300/80">
          Try a more specific question, or one of the examples above.
        </div>
        {result.dropped_citations > 0 ? (
          <div className="mt-2 text-xs text-amber-300/80">
            {result.dropped_citations} citation(s) failed verification and were dropped.
          </div>
        ) : null}
        <RetrievedList result={result} />
      </div>
    );
  }
  return (
    <div className="mt-4 rounded border border-zinc-700/70 bg-zinc-950 p-3">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">{result.answer}</p>
      <Receipts citations={result.citations} />
      {result.retried ? (
        <div className="mt-2 text-xs text-amber-400/80">
          Answer required one retry: initial figures lacked a verified citation.
        </div>
      ) : null}
      {result.dropped_citations > 0 ? (
        <div className="mt-2 text-xs text-zinc-500">
          {result.dropped_citations} citation(s) failed verification and were dropped.
        </div>
      ) : null}
      <RetrievedList result={result} />
    </div>
  );
}

function RetrievedList({ result }: { result: GroundedResult }) {
  return (
    <details className="mt-3 text-xs text-zinc-400">
      <summary className="cursor-pointer select-none hover:text-zinc-200">
        Retrieved passages (k={result.retrieved.length})
      </summary>
      <ul className="mono mt-1 space-y-1 rounded border border-zinc-800 bg-zinc-900 p-2">
        {result.retrieved.map((r) => (
          <li key={r.id}>
            {r.id} — {r.doc} p.{r.page} score={r.score.toFixed(2)}
          </li>
        ))}
      </ul>
    </details>
  );
}
