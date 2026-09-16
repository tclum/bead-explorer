# Hawaiʻi BEAD Explorer

A weekend exploration of Hawaiʻi's public BEAD (Broadband Equity, Access, and
Deployment) documents. Answers are grounded only in the loaded sources; every
value shows its receipt.

Not affiliated with the State of Hawaiʻi, the University of Hawaiʻi, NTIA, the
FCC, or any vendor. Public data only.

## What it does

- Loads a small corpus of public government PDFs and HTML pages about
  Hawaiʻi's BEAD program.
- Serves a one-screen UI with a program-status panel and a Q&A input.
- Answers only from the loaded corpus. Every answer includes verbatim quote
  receipts with links back to the source page.
- Refuses when the corpus does not contain the answer.

## How provenance is enforced

**Retrieval** is BM25 (via `minisearch`) over per-page chunks, with
stop-word removal in `processTerm`, and per-document diversity re-ranking
over a top-32 candidate pool controlled by
`CANDIDATE_POOL_MULTIPLIER = 4` and `PER_DOC_PENALTY = 0.7`
(the effective score is `raw / (1 + PER_DOC_PENALTY * count_from_same_doc)`).
The model receives k=12 passages, and the Anthropic Messages API is called
with a forced tool call (`grounded_answer`); the `temperature` parameter is
NOT sent because `claude-sonnet-5` rejects it as deprecated.

**Quote verification with re-attribution.** Every returned citation is
verified server-side: its quote (after normalization) must be a substring of
the retrieved chunk it cites. If the quote is not in the cited chunk but IS
verbatim in exactly one other retrieved chunk, the citation is kept with the
corrected `passage_id` and `reattributed: true`. If the quote is not in any
retrieved chunk, or it appears in more than one, the citation is dropped and
counted. If a non-refusal answer has zero surviving citations, the server
converts it to a refusal — the model's word is never trusted.

**Number coverage with one retry.** After verification, every canonical
number, date, dollar amount, and percentage in the answer must appear as a
whole token (non-digit/non-decimal boundary on each side) in the
comma-stripped concatenation of the verified quotes. If not, the server sends
one follow-up turn in the same conversation telling the model that it may
remove any figure it cannot cite verbatim, but may not add new figures or
new claims. The follow-up hints which retrieved passages contain each
uncovered number. Citations from both turns are merged and re-verified.
The retry's answer is accepted only if (a) it is not refused, (b) the
figures it contains are a subset of the first turn's, and (c) every
remaining figure is covered by a verified quote — otherwise the first-turn
answer stands. If figures still lack citations after the merge, the
answer is converted to a refusal. `retried`, `answer_revised`, and
`uncovered_numbers` are surfaced in `GroundedResult` and in the UI.

**Refusals carry no figures and no citations.** Whenever the final result
has `refused: true` — whether the model refused directly or the server
converted the answer — the server empties `answer`, empties `citations`,
and rewrites `refusal_reason` to a generic figure-free sentence if the
model's own reason contains any digit. A figure-free model reason (e.g.
"the passages cover Hawaiʻi, not Texas") is kept as-is.

**Prompt caching.** The system prompt and the passages block carry
`cache_control: ephemeral`, so the first turn and the retry turn share a
cache prefix (they are byte-identical up through the passages), and repeat
runs of the same question hit the cache. `usage` is captured on every
response and returned in `GroundedResult`; `pnpm eval` prints per-fixture
`in=/cached=/out=` and a line-three cost summary using a single-source
price table.

Normalization (`src/lib/normalize.ts`) is used everywhere text is compared:
NFKD, drop combining marks, drop `ʻ ' ’ ‘ ` ´`, map en/em dashes to `-`, map
curly double quotes to `"`, lowercase, collapse whitespace.

## Data sources

Every document is committed under `data/raw/` for reproducibility. The
manifest is `data/sources.json`.

| id | Title | Publisher | Date |
|---|---|---|---|
| `fp` | State of Hawaiʻi BEAD Final Proposal v2.0 (NTIA-approved) | UH Broadband Office | 2025-11-18 |
| `fp-appendix` | BEAD Final Proposal Appendix v2.0 | UH Broadband Office | 2025-11-18 |
| `ntia-fp-overview` | BEAD Final Proposal: Hawaii Overview | NTIA BroadbandUSA | 2025-12 |
| `ipv1` | Initial Proposal Volume 1 (Approved-Final) | UH Broadband Office | 2024-06-04 |
| `ipv2` | Initial Proposal Volume 2 (Approved-Final) | UH Broadband Office | 2024-07-16 |
| `cpg` | Challenge Process Resource Guide v1.2 | UH Broadband Office | 2024-10-04 |
| `uhbo-challenge` | UHBO Challenge Process results page | UH Broadband Office | 2025-01-10 |
| `uhbo-final-proposal` | UHBO Final Proposal program page | UH Broadband Office | undated |
| `ntia-pr-2025-11-18` | NTIA release: approval of 18 Final Proposals | NTIA | 2025-11-18 |
| `ltgov-pr-2025-12-23` | Lt. Governor release: federal approval advances broadband expansion | State of Hawaiʻi | 2025-12-23 |
| `uh-news-2026-08-04` | UH News: $150M broadband expansion begins | UH News | 2026-08-04 |

FCC Broadband Data Collection Hawaiʻi state + county rows are pulled by
`scripts/fetch-fcc.ts` from the Esri Living Atlas republication of the FCC
BDC data (anonymous ArcGIS REST). See `data/fcc-hi-summary.meta.json` for the
retrieval date, query URLs, and vintage sentence.

## Run locally

```bash
pnpm install
# Put your Anthropic API key in .env.local
#   ANTHROPIC_API_KEY=sk-ant-...
#   ANTHROPIC_MODEL=claude-sonnet-5   # optional override
pnpm ingest        # extract corpus.json from data/raw/
pnpm fetch:fcc     # refresh data/fcc-hi-summary.csv
pnpm dev           # http://localhost:3000
pnpm eval          # live eval (needs API key)
pnpm eval --selftest  # offline assertion self-test
pnpm ask "<question>" [--retrieved]   # run askGrounded locally and print the GroundedResult
pnpm smoke <base-url>                 # POST two probe questions to a deployed route and verify the contract
```

## Deploy

Deploys to Vercel via git connection: pushing to `main` deploys production;
pushing to any other branch produces a preview. The Vercel project is
`bead-explorer` under team `tclum-4994s-projects`. `npx vercel --prod` is
not needed. After a push, verify the deployed route with:

```bash
pnpm smoke https://bead-explorer.vercel.app
```

## License

- Code: MIT.
- Documents in `data/raw/` remain the property of their respective publishers.
