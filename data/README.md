# data/

## Manifest

`sources.json` (`manifestVersion: 1`) lists every document loaded into the
corpus: `id, short, title, publisher, date, kind, url, expect_pages` (PDFs),
optional `page_range` and `notes`. Two optional per-source knobs let a source
tune HTML extraction without touching code:

- `selector` (string, CSS): the content-container to extract from, tried
  ahead of the built-in `.entry-content → article → main → body` fallback.
- `strip` (array of CSS selectors): removed from the DOM *before* the
  container is selected, on top of the built-in strip list (`script, style,
  noscript, nav, header, footer, aside, form, iframe, [role=navigation],
  .menu, .nav, .sidebar, .breadcrumb, .site-header, .site-footer, .skip-link`).

The ingest script fills each entry with `sha256`, `bytes`, `pages`, and
`fetched_at` after downloading.

## Raw originals are committed

Every downloaded PDF and HTML file is committed to `data/raw/` (as
`<id>.pdf` or `<id>.html`) so the build never depends on a government host
being reachable. If a host blocks the ingest script, drop the file into
`data/raw/<id>.<ext>` by hand and re-run `pnpm ingest`.

## Page numbers

Page numbers everywhere in this app (chunk `page`, citation `page`,
`page_url` anchors) are **physical PDF pages**, one-based, matching the
`#page=N` anchor the browser accepts. They are not the printed folio
numbers on the PDF's own body pages.

## Chunking

`src/lib/chunk.ts` is sentence-aware. Each page is first split into
paragraphs (a blank line separates paragraphs where the source has them; for
PDFs with only single-newline text, adjacent lines are re-flowed by heuristic
into paragraphs and end-of-line hyphenation is joined). Each paragraph is
split on sentence boundaries. Sentences are then greedy-packed into chunks
of at most 1,200 characters joined with single spaces, and `\n\n` is kept
only at real paragraph boundaries inside a chunk. Each chunk carries the
previous chunk's last sentence (if 240 characters or fewer) as overlap.
`MAX_CHUNK_CHARS` stays 1,440; every chunk lies in `[40, 1440]`. Ingest
also fails if the share of chunks whose text ends in one of
`. : ; ? ! ) " %` drops below 0.80 for any of `fp`, `fp-appendix`,
`ipv1`, `ipv2`, or `cpg` — a smoke test that the reflow found real
paragraphs.

## Files

- `sources.json` — corpus manifest.
- `raw/` — committed originals.
- `corpus.json` — generated chunks. Written by `pnpm ingest`.
- `status.json` — status-panel values with provenance. Hand-written; the
  eval checks each `quote` against the ingested text and each CSV column
  against `fcc-hi-summary.csv`.
- `fcc-hi-summary.csv` — FCC Broadband Data Collection Hawaiʻi state + county
  rows. Written by `pnpm fetch:fcc`.
- `fcc-hi-summary.meta.json` — retrieval metadata for the CSV.
