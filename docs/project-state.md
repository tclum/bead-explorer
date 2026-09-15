# Project state — `bead-explorer`

## Destination

A live URL showing Hawaiʻi's BEAD program status and unserved/underserved
picture from public data, answering questions grounded only in loaded public
documents with per-value provenance, gated by an eval harness.

## Shipped

- **2026-09-15** — Milestone A: Next.js 15 scaffold; ingest pipeline for the
  11-source public corpus (6 PDFs + 5 HTML); FCC BDC Hawaiʻi state+county pull
  from the Esri republication. 300 → 601 → 581 chunks (chunker rewrite;
  per-source HTML overrides). All PDF page counts match `expect_pages`; every
  chunk in `[40, 1440]` chars.
- **2026-09-15** — HTML extraction fix: dropped `div` from paragraph tag list
  (parent-div text was double-counted with child paragraphs); added optional
  per-source `selector` / `strip` fields in `sources.json`; wrote overrides for
  `ntia-pr-2025-11-18` (Drupal press release: `article.node--type-press-releases`
  + strip `.field--name-field-office/-program/-funding-programs`) and
  `uh-news-2026-08-04` (WordPress WPEX: `.single-blog-content` + strip
  related-posts, share, tags, pagination).
- **2026-09-15** — Milestone B: `normalize`/`retrieve`/`verify`/`ground`; API
  route `POST /api/ask` (Node.js runtime, per-IP rate limit); dark UI with
  StatusPanel, AskPanel, Receipts, CorpusList; assertion library + fixture set
  (8 positive + 2 refuse); selftest with 11 cases (8 must-fail, 3 must-pass);
  live eval currently green.
- **2026-09-15** — Retrieval re-ranker made explicit: BM25 with stop-word
  removal, top-32 candidate pool (`CANDIDATE_POOL_MULTIPLIER = 4`), per-doc
  MMR-lite penalty (`PER_DOC_PENALTY = 0.7`), k=12. This is what admits the
  answer-bearing chunks that raw BM25 ranks 9–10 for the two hard fixtures.
- **2026-09-15** — Prompt caching + usage telemetry + `--only`. System prompt
  and the passages block carry `cache_control: ephemeral` so the first and
  retry turns share a cache prefix and eval reruns of the same question hit the
  cache. `askGrounded` returns a `usage` object (input/output plus cache
  create/read). `pnpm eval` prints per-fixture `in=/cached=/out=` and a
  line-three cost summary using a single-source price table
  (`claude-sonnet-5` at $2/$10 per MTok, cache write $2.50, cache read $0.20).
  `pnpm eval --only <id>[,<id>...]` runs offline checks plus just those
  fixtures.
- **2026-09-15** — Claim-level number coverage added. `verifyCitations`
  re-attributes a citation whose quote is verbatim in exactly one other
  retrieved chunk; `extractNumbers` + `numbersCovered` enforce that every
  canonical number in the answer appears as a whole token in the
  comma-stripped concatenation of the verified quotes; `askGrounded` runs one
  follow-up turn if figures are uncovered, hinting which passages contain the
  missing figures, and refuses if any figure remains uncovered after the retry.
  System prompt gained rules 6/7/8 and a citation-guidance paragraph.
  `GroundedResult` gained `retried` and `uncovered_numbers`. `assertFixture`
  gained a `numbers` check that runs the production coverage function.
  Selftest gained cases `l` (must-fail: figure missing from every verified
  quote) and `m` (must-pass: quote verbatim in a retrieved chunk other than
  labeled → kept with `reattributed=true`).

## Pipeline deviations from the original Slice 1 prompt, with reasons

1. **`temperature` removed from Anthropic call.** `claude-sonnet-5` returns
   `400 invalid_request_error: temperature is deprecated for this model.` The
   forced tool schema, k=12, and small answer surface keep behavior stable
   without it.
2. **k=12 (not 8) for the model context.** BM25 ranks the "37,593" answer
   chunk (`uhbo-challenge:p1:1`) at rank ~9 for the f04 query, and the
   `$30`-bearing `ipv2:p98:2` at rank ~10 for f05. Bumping k to 12 admits both
   without changing retrieval scoring. Applied in `askGrounded`'s default and
   `eval/fixtures.json`'s `"k"`.
3. **Retrieval adds stop-word removal and per-doc MMR-lite.** `processTerm`
   drops function words (`how`, `many`, `is`, `the`, etc.) so answer-bearing
   chunks are not down-ranked by common-word noise. Selection is greedy with
   `effective = score / (1 + 0.7 * count_from_same_doc)` over a top-32
   candidate pool, giving room for the correct doc when one doc dominates raw
   scores.

## Do

- **Between gates, tune with `pnpm eval --only <id>[,<id>...]`.** The full
  fixture suite runs only at a gate. Rationale: iterating on one fixture with
  the full 10-fixture run burned a large fraction of a day's API spend today.
  A cold session should reach for `--only` first when investigating a single
  fixture; the full suite is the greenlight check, not the tuning loop.

## Do not touch

(empty)

## Open questions

(empty)

## Not yet specified

- Slice 2 map/chart panels (county choropleth of FCC BDC vs BEAD project areas).
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

## Out of scope

- Auth, databases, multi-state expansion, CI wiring, scraping, or cloning any
  vendor product.
