# data/

## Manifest

`sources.json` (`manifestVersion: 1`) lists every document loaded into the corpus:
`id, short, title, publisher, date, kind, url, expect_pages` (PDFs), optional
`page_range` and `notes`. The ingest script fills each entry with `sha256`,
`bytes`, `pages`, and `fetched_at` after downloading.

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
