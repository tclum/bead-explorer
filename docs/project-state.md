# Project state — `bead-explorer`

## Destination

A live URL showing Hawaiʻi's BEAD program status and unserved/underserved
picture from public data, answering questions grounded only in loaded public
documents with per-value provenance, gated by an eval harness.

Workflow pages (Slices 4–8, scoped 2026-09-17): a home screen plus one page
per workflow the Final Proposal describes, built only from public Hawaiʻi
documents and datasets, every figure carrying a receipt the eval verifies
and every page probed by smoke. The home screen stays the demo path.

## Shipped

- **2026-09-15** — `fcc32cd`/`119bfea`/`1b5ebfe`: Milestones A–B — ingest (11 sources, 581 chunks), HTML extraction, retrieval + verification + number coverage + prompt caching + `--only`.
- **2026-09-16** — `caf98c8`: Slice 1.1 — hardened refusal path; `pnpm ask`/`smoke`. First deploy.
- **2026-09-16** — `19de3a2`: Slice 1.2 — sentence-aware chunking, segment verification, drop reasons, f09, `/api/version` + SHA-checked smoke; `k=20`, pool ×6.
- **2026-09-16 decision** — **Withhold, don't refuse.** Uncovered sentences after retry are pruned; refusal only when the pruned answer is empty. Selftest u/v.
- **2026-09-16** — `fecdcdf`: Slice 2 — county choropleth + two-series table (FCC BDC Dec 2025 beside BEAD FP Dec 2024), `pnpm fetch:bead`/`geo`, smoke probe 3.
- **2026-09-17** — `3cfdb1a`: Slice 3 — ink palette + Fraunces/JetBrains Mono via `next/font/google` (self-hosted); provenance strip, ask elapsed, build-SHA footer.
- **2026-09-17 decision**: workflow pages named after Final Proposal sections, never vendor products. Order: `/challenge`, `/selection`, `/oversight`, `/projects`, `/anchors` (conditional). Figures in `data/pages/<page>.json`; pages embed Ask, never touch `src/lib/*`.
- **2026-09-17** — `098e7e3`: Slice 4 — `/challenge` + site frame (nav, footer, `src/lib/build.ts`); `data/pages/challenge.json`; `assertPageData` + `pnpm eval` pages loop; smoke v0.4.0; f10/f11; selftest x/y/z.
- **2026-09-18** — `7476965`: Slice 5 — `/selection` + shared page components (`src/components/page/*`); `data/pages/selection.json` with `calculator`; `total_key` + `PageCalculator` in types + `assertPageData`; `src/lib/score.ts` + tests driven by the file's `expected`; `ScoreCalculator`; smoke v0.5.0 (loops `data/pages/*.json`, asserts `data-computed`); f12/f13; selftest aa/ab/ac/ad.
- **2026-09-19** — Slice 6 (this commit): `/oversight` (monitoring, risk tiers, reimbursement, commitments) + `data/pages/oversight.json`; `group?` on `PageWho`/`PageEvidence` with grouped rendering in `QuoteList`/`EvidenceTable`; `/report` (receipted report) with `PrintButton` and a print stylesheet; nav gains Oversight and Receipted report (five hrefs, test updated); smoke v0.6.0 (adds `/report` receipts probe); f14/f15; selftest ae/af.

See `docs/findings-provenance.md` for the durable lessons behind these
entries (chunker, verification, retry rules, retrieval, cost).

## Do

- **Between gates, tune with `pnpm eval --only <id>[,<id>...]`.** The full suite
  runs only at a gate (three consecutive full runs, ~$0.30 with caching); see
  `docs/findings-provenance.md` (cost lesson).

## Deploy

- **Canonical URL**: <https://bead.forpono.com> (alias: `bead-explorer.vercel.app`).
- **Vercel project `bead-explorer`, team `tclum-4994s-projects`, git-connected**:
  push to `main` deploys production, other branches preview. Verify with
  `pnpm smoke https://bead.forpono.com` (SHA-checked before probes run).

## Do not touch

(empty)

## Open questions

- **Flake log (research)**: f04 (Slice 5, 2026-09-18) refused once with
  uhbo-challenge:p1:2 at rank 17/20, reroll clean. f12 (Slice 6, 2026-09-19)
  answered from a pre-restructuring version ("Total Points were 365",
  missing 200), reroll 5/5 clean. Capture `pnpm ask --debug` on recurrence.
- **2026-09-18 research**: the per-document diversity penalty pushed fp:p26
  and fp:p29 out of the top 20 for f13 while five other fp chunks got in.
  Probe: f13 with cite restricted to fp pages; measure PER_DOC_PENALTY
  variants over three runs before changing anything. Retrieval tuning is its
  own slice.
- **2026-09-16 research**: would numbered passage labels (`[1]..[12]`) reduce
  mis-labeled citations? Measure over three eval runs with each labeling.
- **2026-09-16 research**: retrieval quality for short or broad queries; f09 is the probe.
- **2026-09-17 research**: columns, row counts, and gate values for the four
  approved Final Proposal spreadsheets not yet fetched (`fp_subgrantees_approved.xlsx`,
  `fp_deployment_projects_approved.xlsx`, `fp_no_BEAD_locations_approved.xlsx`,
  `fp_cai_approved.xlsx`). Resolve in each fetch script's recon step.
- **2026-09-17 research**: does the challenge-results zip carry per-challenge
  records with county or location id? If so, a county breakdown is possible.
- **2026-09-17 research**: owner, access, and terms of the AGOL layer
  `fp_locations_approved` before any per-location map; vintage and columns of
  the 2024 CAI list v3 versus `fp_cai_approved.xlsx`.

## Not yet specified

- Any per-source override for `uhbo-challenge` if the FAQ-heavy content
  competes with the answer chunk on other queries.
- Whether to embed a small MMR/BM25 tuning report in the UI.

## Accepted gaps

- FCC statewide/county rows come from the Esri Living Atlas republication of the
  FCC BDC data, not a direct FCC download. Task: swap when a direct FCC file is in hand.
- NTIA's Final Proposal Overview counts **7,033** locations while the approved files
  hold **7,009** unserved/underserved rows plus **23** CAI rows. The tile shows 7,033.
- The Challenge Process Guide's page 42 (version-history table) is excluded
  from the corpus via `page_range: [1, 41]`.
- Claim coverage is numeric only. Names and dates rendered as prose (e.g., "the
  Final Proposal", "August 2024") are not claim-checked; only the digit runs are.
- Refusal explanations are model text checked only for figures, not claims:
  figure-free reasons pass through; digit-bearing reasons are rewritten.
- The BEAD project-areas series counts approved-funded locations by project area
  (7,009 total), not a served/unserved measure of the whole county — it cannot
  be added or subtracted against FCC BDC BSL tiers (different fabric).
- The UHBO Challenge Process page's six challenge-type counts sum to **37,595**
  against a stated total of **37,593**; `/challenge` shows both, source unexplained.
- The `/selection` calculator covers only the formulaic criteria (Outlay Parts
  1/2, Speed to Deployment); the 15 percent rule and judged technical sub-scores
  are described, not computed.
- The oversight page shows the state's monitoring and reimbursement commitments;
  no subgrantee report, site-visit result, or reimbursement is public yet, so
  the page cannot show performance against them.

## Out of scope

- Auth, databases, multi-state expansion, CI wiring, scraping, or cloning any
  vendor product.
- Naming, modeling, or describing pages after any vendor's products; pages
  use the Final Proposal's own section names.
- A page for edge or field hardware: no public-data analog.
- Documents outside the BEAD corpus (for example the state Digital Equity
  Plan) until a page needs one and the Destination is redrawn.
