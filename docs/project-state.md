# Project state — `bead-explorer`

## Destination

A live URL showing Hawaiʻi's BEAD program status and unserved/underserved
picture from public data, answering questions grounded only in loaded public
documents with per-value provenance, gated by an eval harness.

## Shipped

- **2026-09-15** — `fcc32cd`: Milestone A scaffold + ingest pipeline (11
  sources, 581 chunks).
- **2026-09-15** — `119bfea`: HTML extraction fix; per-source
  `selector`/`strip` overrides.
- **2026-09-15** — `1b5ebfe`: Milestone B — retrieval + verification +
  claim-level number coverage + prompt caching + `--only`.
- **2026-09-16** — `caf98c8`: Slice 1.1 refusal path hardened (subset-rule
  retry, figure-free refusals); `pnpm ask` + `pnpm smoke` scripts. Deployed
  to https://bead-explorer.vercel.app.
- **2026-09-16** — Slice 1.2 (this commit): sentence-aware chunking,
  segment-level citation verification with multi-match re-attribution
  and drop reasons, broad-question fixture f09, `/api/version` +
  SHA-checked smoke. Retrieval retuned: `k=20`, `PER_DOC_PENALTY=0.35`,
  pool ×6, and `MAX_TOKENS=2048`. System prompt gained rules 9/10
  ("answer the question asked; do not enumerate breakdowns"; "at most
  six citations"). See `docs/findings-provenance.md` for the bullet-list
  verification lesson (f03 flake root cause and fix).
- **2026-09-16 decision** — **Withhold, don't refuse.** Sentences whose
  figures remain uncovered after the retry are pruned from the answer
  (chunker-style sentence split, canonical whole-token match) instead of
  flipping the whole answer to a refusal. Refusal only fires when the
  pruned answer is empty. Withheld figures do not appear in the API
  response or UI; `withheld_count` is public, `withheld_sentences` is
  server-only (`--debug` on `pnpm ask` opts in). UI: one-liner under the
  answer. Eval: per-fixture `withheld=N`. Selftest cases `u`/`v` lock
  the contract.
- **2026-09-16** — Slice 2: "Where the gaps are" section between the
  status panel and the Ask box. Inline SVG county choropleth shaded by
  the FCC BDC unserved share, two-series table (FCC BDC Dec 2025 beside
  BEAD Final Proposal Dec 2024 project areas), footnote on definitions,
  receipts disclosure. New fetch scripts `pnpm fetch:bead` (parses the
  NTIA-approved `fp_locations_approved.xlsx`, 7,009 rows, into
  `data/bead-hi-project-areas.csv` with hard gates) and `pnpm fetch:geo`
  (pulls Hawaiʻi county polygons from Census TIGERweb, drops the
  Northwestern Hawaiian Islands rings). Shared `formatCount` helper so
  map, table, and smoke agree byte for byte. Eval offline: two new
  `PASS data` lines plus selftest case `w` (must fail). Smoke: third
  probe `GET /` verifies every county's FCC unserved and every project
  area's BEAD total appear on the page; bumped to `smoke v0.3.0`.

See `docs/findings-provenance.md` for the durable lessons behind these
entries (chunker, verification, retry rules, retrieval, cost).

## Do

- **Between gates, tune with `pnpm eval --only <id>[,<id>...]`.** The full
  10+-fixture suite runs only at a gate. A gate is three consecutive full
  runs, about $0.30 with caching. Rationale in
  `docs/findings-provenance.md` (cost lesson).

## Deploy

- **Vercel project `bead-explorer`, team `tclum-4994s-projects`,
  git-connected**: push to `main` deploys production, other branches
  preview. Verification: `pnpm smoke https://bead-explorer.vercel.app`
  first checks that the deployed SHA matches local HEAD before running
  probes.

## Do not touch

(empty)

## Open questions

- **2026-09-16 research**: would numbered passage labels (`[1]..[12]`)
  reduce mis-labeled citations? Two of three citations on the deployed
  challenge question were re-attributed. Measure re-attributed counts
  over three eval runs with each labeling before changing anything.
- **2026-09-16 research**: retrieval quality for short or broad queries;
  f09 is the probe.
- **2026-09-16 task**: upgrade Node on MacBook-Pro-437 from 20.11.1 to 22
  LTS between slices; Vercel CLI dependencies warn on 20.11.

## Not yet specified

- Any per-source override for `uhbo-challenge` if the FAQ-heavy content
  competes with the answer chunk on other queries.
- Whether to embed a small MMR/BM25 tuning report in the UI.

## Accepted gaps

- FCC statewide/county rows come from the Esri Living Atlas republication of
  the FCC BDC data rather than a direct FCC download. Task: swap when a
  direct FCC file is in hand.
- NTIA's Final Proposal Overview counts **7,033** locations while the
  approved location files hold **7,009** unserved/underserved rows plus **23**
  CAI rows. The tile shows 7,033 with the NTIA receipt.
- The Challenge Process Guide's page 42 (version-history table) is excluded
  from the corpus via `page_range: [1, 41]`.
- Claim coverage is numeric only. Names and dates rendered as prose (e.g.,
  "the Final Proposal", "August 2024") are not claim-checked; only the digit
  runs a claim contains are checked against the citation quotes.
- Refusal explanations are model text checked only for figures, not for
  claims. A figure-free reason is passed through as-is; a reason with
  digits is replaced by a fixed generic sentence.
- The BEAD project-areas series counts approved-funded locations by
  project area (7,009 total) and is not a served/unserved measure of the
  whole county. It cannot be added or subtracted against the FCC BDC
  BSL tiers, which use a different location fabric.

## Out of scope

- Auth, databases, multi-state expansion, CI wiring, scraping, or cloning any
  vendor product.
