import { readFileSync } from "node:fs";
import path from "node:path";
import type { Manifest } from "@/lib/types";

export default function CorpusList() {
  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), "data", "sources.json"), "utf8"),
  ) as Manifest;
  return (
    <section aria-labelledby="corpus-title" className="w-full">
      <h2 id="corpus-title" className="mb-3 text-lg font-semibold text-zinc-200">
        Loaded corpus
      </h2>
      <div className="mono overflow-x-auto rounded border border-zinc-800 bg-zinc-900/60 text-xs">
        <table className="w-full text-left">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="px-2 py-1">short</th>
              <th className="px-2 py-1">kind</th>
              <th className="px-2 py-1">pages</th>
              <th className="px-2 py-1">sha256</th>
              <th className="px-2 py-1">fetched_at</th>
              <th className="px-2 py-1">url</th>
            </tr>
          </thead>
          <tbody>
            {manifest.sources.map((s) => (
              <tr key={s.id} className="border-t border-zinc-800">
                <td className="px-2 py-1 text-zinc-200">{s.short}</td>
                <td className="px-2 py-1 text-zinc-400">{s.kind}</td>
                <td className="px-2 py-1 text-zinc-400">{s.pages ?? "-"}</td>
                <td className="px-2 py-1 text-zinc-500">{(s.sha256 ?? "").slice(0, 12)}</td>
                <td className="px-2 py-1 text-zinc-500">{s.fetched_at ?? "-"}</td>
                <td className="px-2 py-1">
                  <a
                    className="text-sky-400 hover:text-sky-300"
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
