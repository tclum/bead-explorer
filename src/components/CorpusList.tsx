import { readFileSync } from "node:fs";
import path from "node:path";
import type { Manifest } from "@/lib/types";

export default function CorpusList() {
  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), "data", "sources.json"), "utf8"),
  ) as Manifest;
  return (
    <section aria-labelledby="corpus-title">
      <h2 id="corpus-title" className="mb-6 font-serif text-2xl font-medium text-paper">
        Loaded corpus
      </h2>
      <div className="overflow-x-auto rounded border border-ink-800 bg-ink-900 font-mono text-xs">
        <table className="w-full text-left">
          <thead className="bg-ink-900 text-paper-3">
            <tr>
              <th className="px-3 py-2">short</th>
              <th className="px-3 py-2">kind</th>
              <th className="px-3 py-2">pages</th>
              <th className="px-3 py-2">sha256</th>
              <th className="px-3 py-2">fetched_at</th>
              <th className="px-3 py-2">url</th>
            </tr>
          </thead>
          <tbody>
            {manifest.sources.map((s) => (
              <tr key={s.id} className="border-t border-ink-800">
                <td className="px-3 py-2 text-paper">{s.short}</td>
                <td className="px-3 py-2 text-paper-2">{s.kind}</td>
                <td className="px-3 py-2 text-paper-2">{s.pages ?? "-"}</td>
                <td className="px-3 py-2 text-paper-3">{(s.sha256 ?? "").slice(0, 12)}</td>
                <td className="px-3 py-2 text-paper-3">{s.fetched_at ?? "-"}</td>
                <td className="px-3 py-2">
                  <a
                    className="text-teal hover:underline"
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
