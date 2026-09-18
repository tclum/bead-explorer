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
- `bead-hi-project-areas.csv` — one row per BEAD Final Proposal county
  project area (Hawaii, Honolulu, Kauai, Maui) with `unserved,
  underserved, total, fiber, leo`. Written by `pnpm fetch:bead` from the
  NTIA-approved `fp_locations_approved.xlsx` (7,009 rows). Gates enforced
  in the fetch script and re-checked offline by `pnpm eval`:
  - row count equals 7,009; classification ∈ {0,1}; technology ∈ {50,61}
  - county totals sum to 7,009; unserved+underserved=6,632+377; per row
    `unserved+underserved=total` and `fiber+leo=total`
  - project_id suffix maps to county exactly (HAWAII→Hawaii, HONOLULU→Honolulu,
    KAUAI→Kauai, MAUI→Maui); Kalawao is not a separate project area.
- `bead-hi-project-areas.meta.json` — retrieval metadata (source URL,
  sha256, bytes, `fetched_at`, code mappings, note on Kalawao).
- `hi-counties.geojson` — Hawaiʻi's five counties as GeoJSON polygons.
  Written by `pnpm fetch:geo` from Census TIGERweb (Generalized ACS2023).
  Northwestern Hawaiian Islands rings of Honolulu County are removed (all
  vertices west of longitude −160.6). Coordinates are rounded to five
  decimals; only `GEOID` and `NAME` are kept. Gates: exactly five
  features; GEOIDs are exactly 15001, 15003, 15005, 15007, 15009; file is
  under 150 KB.
- `hi-counties.meta.json` — retrieval metadata for the geojson.
- `raw/fp_locations_approved.xlsx` — original NTIA Final Proposal
  approved-locations workbook.
- `raw/hi-counties-tigerweb.geojson` — original TIGERweb response.
- `pages/<page>.json` — page-scoped figures with per-value provenance.
  Hand-written. One file per workflow page under `src/app/<page>/`.

## `data/pages/<page>.json` format

Each file describes the figures on one page. Shape (`pageVersion: 1`):

- `page`, `title` — routing slug and page heading.
- `items[]` — headline tiles. Each has `key, label, value` (string or number)
  and `source: { doc, page, quote }`.
- `phases[]` — process phases. Each has `key, label, value` and `source`.
- `breakdowns[]` — proportional tables. Each has `key, title, sum_expected`
  (integer), optional `note`, and `rows[]` where each row has
  `label, value` (integer) and `source`. Rows must sum to `sum_expected`;
  when they don't, the page renders the mismatch in-line and the `note`
  explains it.
- `who[]`, `evidence[]` — supporting list items, each with a `source`.

Gates enforced by `pnpm eval` (per file, always run):

- Every `source.quote` normalizes to a substring of the ingested text at
  `doc:page` (same rule as `status.json` — see `assertQuoteInCorpus`).
- For each breakdown, the row values sum to `sum_expected` exactly.

`pnpm eval --selftest` covers three page-data cases:
`x` (a quote that isn't in the canned corpus, must fail), `y` (rows that
don't sum, must fail), `z` (a valid two-row page, must pass).
