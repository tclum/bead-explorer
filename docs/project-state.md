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

- **2026-09-15** — `fcc32cd`/`119bfea`/`1b5ebfe`: Milestones A–B — ingest pipeline
  (11 sources, 581 chunks), HTML extraction, retrieval + verification + number
  coverage + prompt caching + `--only`.
- **2026-09-16** — `caf98c8`: Slice 1.1 — hardened refusal path; `pnpm ask`/`smoke`. First deploy.
- **2026-09-16** — `19de3a2`: Slice 1.2 — sentence-aware chunking, segment verification, drop reasons, f09, `/api/version` + SHA-checked smoke; `k=20`, pool ×6.
- **2026-09-16 decision** — **Withhold, don't refuse.** Uncovered sentences after retry
  are pruned; refusal only when the pruned answer is empty. Selftest u/v.
- **2026-09-16** — `fecdcdf`: Slice 2 — county choropleth + two-series table
  (FCC BDC Dec 2025 beside BEAD FP Dec 2024), `pnpm fetch:bead`/`geo`, smoke probe 3.
- **2026-09-17** — `3cfdb1a`: Slice 3 — ink palette + Fraunces/JetBrains Mono via
  `next/font/google` (self-hosted); provenance strip, ask elapsed, build-SHA footer.
- **2026-09-17 decision**: workflow pages are named after Final Proposal sections,
  never vendor products. Order: `/challenge`, `/selection`, `/oversight`,
  `/projects`, `/anchors` (conditional). Figures in `data/pages/<page>.json` with
  eval-checked receipts; pages embed the Ask box and never touch `src/lib/*`.
- **2026-09-17** — Slice 4 (this commit): `/challenge` + site frame
  (SiteHeader nav, SiteFooter, `src/lib/build.ts`); `data/pages/challenge.json`;
  `assertPageData` + `pnpm eval` pages loop; smoke v0.4.0 (per-page probe +
  fonts/stamp attribution); f10, f11 fixtures; selftest cases x/y/z.

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

- **2026-09-16 research**: would numbered passage labels (`[1]..[12]`) reduce
  mis-labeled citations? Two of three citations on the deployed challenge question
  were re-attributed. Measure over three eval runs with each labeling.
- **2026-09-16 research**: retrieval quality for short or broad queries; f09 is the probe.
- **2026-09-17 research**: columns, row counts, and gate values for the four
  approved Final Proposal spreadsheets not yet fetched (`fp_subgrantees_approved.xlsx`,
  `fp_deployment_projects_approved.xlsx`, `fp_no_BEAD_locations_approved.xlsx`,
  `fp_cai_approved.xlsx`, linked from the UHBO Final Proposal page). Resolve in each
  fetch script's recon step: print headers and counts, then set gates from them.
- **2026-09-17 research**: does the challenge-results zip ("CSV files" on the
  results page) carry per-challenge records with county or location id? If so,
  a county breakdown of challenges is possible.
- **2026-09-17 research**: owner, access, and terms of the AGOL layer
  `fp_locations_approved` (lat/lon per funded location) before any per-location map.
- **2026-09-17 research**: vintage and columns of the 2024 CAI list v3
  (UHBO Initial Proposal page) versus `fp_cai_approved.xlsx`.

## Not yet specified

- Any per-source override for `uhbo-challenge` if the FAQ-heavy content
  competes with the answer chunk on other queries.
- Whether to embed a small MMR/BM25 tuning report in the UI.
- Workflow pages: per-page Ask chips and fixtures per page; report export form
  (print vs. Markdown); the scoring calculator's input bounds and "computed,
  not quoted" labeling.

## Accepted gaps

- FCC statewide/county rows come from the Esri Living Atlas republication of the
  FCC BDC data, not a direct FCC download. Task: swap when a direct FCC file is in hand.
- NTIA's Final Proposal Overview counts **7,033** locations while the approved files
  hold **7,009** unserved/underserved rows plus **23** CAI rows. The tile shows 7,033.
- The Challenge Process Guide's page 42 (version-history table) is excluded
  from the corpus via `page_range: [1, 41]`.
- Claim coverage is numeric only. Names and dates rendered as prose (e.g., "the
  Final Proposal", "August 2024") are not claim-checked; only the digit runs are.
- Refusal explanations are model text checked only for figures, not claims. A
  figure-free reason passes through; a reason with digits is replaced by a fixed sentence.
- The BEAD project-areas series counts approved-funded locations by project area
  (7,009 total), not a served/unserved measure of the whole county. It cannot be added
  or subtracted against the FCC BDC BSL tiers, which use a different location fabric.
- The UHBO Challenge Process page's six challenge-type counts sum to **37,595**
  against a stated total of **37,593**; `/challenge` shows both, source unexplained.

## Out of scope

- Auth, databases, multi-state expansion, CI wiring, scraping, or cloning any
  vendor product.
- Naming, modeling, or describing pages after any vendor's products; pages
  use the Final Proposal's own section names.
- A page for edge or field hardware: no public-data analog.
- Documents outside the BEAD corpus (for example the state Digital Equity
  Plan) until a page needs one and the Destination is redrawn.
