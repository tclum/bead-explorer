"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      className="no-print rounded border border-ink-700 bg-ink-800 px-4 py-1.5 text-sm text-paper hover:bg-ink-700"
      onClick={() => window.print()}
    >
      Print or save as PDF
    </button>
  );
}
