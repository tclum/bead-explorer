"use client";

import { useEffect, useRef, useState } from "react";
import type { GroundedResult } from "@/lib/types";
import Receipts from "./Receipts";

export type AskChip = { id: string; label: string; question: string };

const DEFAULT_CHIPS: AskChip[] = [
  { id: "f09", label: "About the program", question: "Tell me about Hawaiʻi's BEAD program." },
  { id: "f03", label: "Challenge process dates", question: "What were the dates of the challenge, rebuttal, and final determination phases of Hawaiʻi's BEAD challenge process?" },
  { id: "f06", label: "Who got the awards?", question: "Which companies received Hawaiʻi's BEAD deployment awards, and how long is each one's period of performance?" },
  { id: "r02", label: "Locations connected so far", question: "How many locations has Hawaiian Telcom connected with BEAD funds so far?" },
];

export default function AskPanel({ chips = DEFAULT_CHIPS }: { chips?: AskChip[] } = {}) {
  const [question, setQuestion] = useState<string>("");
  const [result, setResult] = useState<GroundedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading) return;
    startRef.current = performance.now();
    setElapsedMs(0);
    const id = window.setInterval(() => {
      if (startRef.current !== null) {
        setElapsedMs(performance.now() - startRef.current);
      }
    }, 100);
    return () => {
      window.clearInterval(id);
      startRef.current = null;
    };
  }, [loading]);

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
    if (loading) return;
    setQuestion(q);
    submit(q);
  }

  const elapsedS = (elapsedMs / 1000).toFixed(1);

  return (
    <section aria-labelledby="ask-title">
      <h2 id="ask-title" className="mb-6 font-serif text-2xl font-medium text-paper">
        Ask
      </h2>
      <div className="rounded border border-ink-800 bg-ink-900 p-5">
        <label htmlFor="ask-input" className="sr-only">
          Ask a question about Hawaiʻi&apos;s BEAD program
        </label>
        <textarea
          id="ask-input"
          className="w-full resize-y rounded border border-ink-800 bg-ink-950 p-3 font-mono text-sm text-paper outline-none placeholder:text-paper-3 focus:border-teal"
          rows={3}
          maxLength={300}
          placeholder="Ask a plain-language question about Hawaiʻi's BEAD program."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded border border-ink-700 bg-ink-800 px-4 py-1.5 text-sm text-paper hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={() => submit(question)}
            aria-busy={loading}
          >
            {loading ? "Asking…" : "Ask"}
          </button>
          <span className="font-mono text-xs text-paper-3">
            {question.trim().length}/300
          </span>
          <div className="flex flex-wrap gap-2 md:ml-2">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                className="rounded-full border border-ink-700 bg-ink-900 px-3 py-1 text-xs text-paper-2 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => applyChip(c.question)}
                disabled={loading}
                title={c.question}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div
            className="mt-4 font-mono text-sm text-amber"
            aria-live="polite"
            role="status"
          >
            Checking receipts… {elapsedS} s
          </div>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-rose" role="alert">
            {error}
          </p>
        ) : null}
        {result ? <AnswerCard result={result} /> : null}
      </div>
    </section>
  );
}

function AnswerCard({ result }: { result: GroundedResult }) {
  const latencyS = (result.latency_ms / 1000).toFixed(2);
  if (result.refused) {
    return (
      <div className="mt-4 rounded border border-rose bg-ink-900 p-4">
        <div className="text-xs uppercase tracking-wide text-rose">Refused</div>
        <div className="mt-2 text-sm text-paper">
          {result.refusal_reason ?? "The corpus does not answer this question."}
        </div>
        <div className="mt-1 text-xs text-paper-3">
          Try a more specific question, or one of the examples above.
        </div>
        <div className="mt-3 font-mono text-xs text-paper-3">
          {result.model} · {latencyS} s
        </div>
        <DroppedList result={result} />
        <RetrievedList result={result} />
      </div>
    );
  }
  return (
    <div className="mt-4 rounded border border-ink-800 bg-ink-950 p-4">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper">
        {result.answer}
      </p>
      {(result.withheld_count ?? 0) > 0 ? (
        <div className="mt-3 text-xs text-amber">
          {result.withheld_count} figure(s) withheld: no verified receipt.
        </div>
      ) : null}
      <Receipts citations={result.citations} />
      {result.retried ? (
        <div className="mt-3 text-xs text-amber">
          Answer required one retry: initial figures lacked a verified citation.
        </div>
      ) : null}
      <div className="mt-3 font-mono text-xs text-paper-3">
        {result.model} · {latencyS} s
      </div>
      <DroppedList result={result} />
      <RetrievedList result={result} />
    </div>
  );
}

function DroppedList({ result }: { result: GroundedResult }) {
  const dropped = result.dropped ?? [];
  if (dropped.length === 0) return null;
  // Digits are masked to `#` — the dropped quote is unverified model text,
  // so any figures inside it may be hallucinated. The API already applies
  // the same mask; this is defense-in-depth.
  const mask = (s: string) => s.slice(0, 80).replace(/\d/g, "#");
  return (
    <details className="mt-3 text-xs text-paper-3">
      <summary className="cursor-pointer select-none hover:text-paper-2">
        Dropped citations ({dropped.length})
      </summary>
      <ul className="mt-2 space-y-1 rounded border border-ink-800 bg-ink-950 p-2 font-mono">
        {dropped.map((d, i) => (
          <li key={`${d.passage_id}-${i}`}>
            {d.reason} — {JSON.stringify(mask(d.quote))}
          </li>
        ))}
      </ul>
    </details>
  );
}

function RetrievedList({ result }: { result: GroundedResult }) {
  return (
    <details className="mt-3 text-xs text-paper-3">
      <summary className="cursor-pointer select-none hover:text-paper-2">
        Retrieved passages (k={result.retrieved.length})
      </summary>
      <ul className="mt-2 space-y-1 rounded border border-ink-800 bg-ink-950 p-2 font-mono">
        {result.retrieved.map((r) => (
          <li key={r.id}>
            {r.id} — {r.doc} p.{r.page} score={r.score.toFixed(2)}
          </li>
        ))}
      </ul>
    </details>
  );
}
