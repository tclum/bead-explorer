# Findings — provenance pipeline

Load-bearing lessons from building the retrieval + citation-verification
pipeline. Kept out of `project-state.md` on purpose: state is short and
current, findings are long and durable.

## Chunker: single-newline PDF text made every line its own unit

`unpdf` extracts PDF text with single newlines between visual lines and no
blank lines between paragraphs. The old `splitUnits` treated every line as a
unit (≈90 characters), and `chunkPage` joined units with `\n\n`. Two harms:

1. **The model saw prose with blank lines every ~90 characters.** Every
   fixture answer was a short one-line quote, and a broad question ("Tell me
   about the BEAD program.") invited longer quotes that never landed
   verbatim in a single chunk.
2. **Chunk boundaries fell mid-sentence.** `fp:p4:2` ended at "Hawaiʻi will
   see approximately $149.5 million " and the sentence continued in the
   next chunk. A model quote that spanned the boundary was verbatim in
   neither chunk and dropped.

Fix (Slice 1.2): re-flow single-newline pages into paragraphs before
packing. A paragraph boundary is:
- a line ending in `.`, `:`, `;`, `?`, `!`, or `)` followed by a line
  starting with an uppercase letter, a bullet (`●`, `•`, `○`, `-`), or a
  digit + `.` or `)`; or
- a short (≤60 chars) unpunctuated line followed by an upper-case line (a
  heading).
Otherwise consecutive lines are joined with a single space; a line ending
in `-` before a lowercase line drops the hyphen.

Every page is then packed by sentences, not lines. Sentences pack into
chunks of at most 1,200 chars joined with single spaces; `\n\n` is kept
only at real paragraph boundaries inside a chunk; each chunk carries the
previous chunk's last sentence (≤240 chars) as overlap. `MAX_CHUNK_CHARS`
stays 1,440.

Ingest gate: for each of `fp`, `fp-appendix`, `ipv1`, `ipv2`, `cpg`, at
least 80% of chunks must end in one of `. : ; ? ! ) " %`. A drop below
that indicates the reflow failed to find real paragraphs.

Ruled out across all 581 chunks (Slice 1.1): soft hyphens, zero-width
characters, ligatures, double spaces. None was the cause.

## Verification: three ways a citation was silently dropped

1. **Ambiguous re-attribution.** The old rule kept a re-attributed citation
   only if the quote appeared in *exactly one* other retrieved chunk.
   With sentence-level overlap between adjacent chunks, quotes on the
   carried sentence are in two chunks by construction, so both were dropped.
   Fix: re-attribute to the **first** in retrieval order. Never drop for
   ambiguity; same-doc/same-page chunks are the same receipt anyway.
2. **All-or-nothing quote verification.** A two-sentence quote whose first
   sentence was verbatim in a chunk and whose second was imagined was
   worth zero. Fix: sentence-trim fallback. Split the quote on sentence
   boundaries, find the longest run of consecutive sentences whose
   normalized join is a substring of a retrieved chunk, and accept it as
   the citation quote with `trimmed: true` — the run is the model's own
   text for those sentences, so the match proves it verbatim.
3. **No drop reasons anywhere.** The old code counted drops but didn't say
   why any citation was dropped. Diagnosing which of the three causes
   above was firing required reading the code. Fix: `verifyCitations`
   returns `dropped: { passage_id; quote; reason: "too_short" | "not_found" }[]`.
   `pnpm ask` and the UI surface it.

Also: `dropped_citations` was double-counted after a retry (the counter
was `+=` across two verifications). Fix: after the retry, verify the
merged citations once and set `dropped_citations = dropped.length` from
that single result.

## Retry semantics (subset rule)

After the first turn, the server verifies citations and computes number
coverage. If any figure in the answer lacks a verified quote (or every
citation was dropped), the server sends one follow-up turn in the same
conversation:

- The follow-up tells the model plainly: "You may remove any figure you
  cannot cite verbatim; you may not add new figures or new claims."
- It hints which retrieved passages contain each uncovered figure.
- Citations from both turns are merged and re-verified.

The retry's answer is accepted **iff**:
(a) it is not refused,
(b) `extractNumbers(retryAnswer)` is a subset of `extractNumbers(firstAnswer)`
    — drops allowed, additions not,
(c) every remaining figure is covered by a verified quote after merging
    citations.
Otherwise the first-turn answer stands. If figures still lack citations
after the merge, the answer is converted to a refusal.

## Number coverage rule

Every canonical number, date, dollar amount, and percentage in `answer`
must appear as a whole token (non-digit/non-decimal boundary on each
side) in the comma-stripped concatenation of the verified quotes. If not,
the retry above fires; if any figure still lacks a receipt after the
retry, the containing sentence is withheld (see next section). Refusals
are figure-free by construction: `answer=""`, `citations=[]`, and
`refusal_reason` is rewritten to a fixed generic sentence if it contains
any digit.

## Withhold, don't refuse (2026-09-16 decision)

Two full-eval runs on Slice 1.2 flaked on questions with many small
figures (breakdown for `f04`, phase dates for `f03`) even after the
segment-level verification fix: the model would emit one paraphrased
list-item quote whose figure the trimmer couldn't recover, the retry
would rewrite the answer just enough that the subset rule rejected it,
and the whole answer would flip to a refusal. Converting a mostly-good
answer to a refusal is a worse experience than serving the covered
sentences and marking the rest as unavailable.

**Rule.** After verification and one retry, split the answer on the
chunker's sentence boundary. For each sentence, compute
`extractNumbers(sentence)`; if any of those numbers is still in
`uncovered`, drop the whole sentence into `withheld_sentences` and keep
the rest. If the pruned answer is empty, refuse as before; otherwise
serve the pruned answer with `withheld_count` set.

**Disclosure.** The withheld figures themselves must not appear in the
API response or the UI: `withheld_sentences` is stripped by
`/api/ask/route.ts` and by `pnpm ask` (unless `--debug` is passed). The
UI shows only a one-liner `N figure(s) withheld: no verified receipt.`
under the answer. `withheld_count` is public, `withheld_sentences` is
server-only.

Selftest cases `u` (two-sentence answer pruned to the covered first
sentence, must-pass) and `v` (required substring lives in the pruned
sentence, must-fail — content check fires after pruning) lock the
contract in.

## Retrieval: BM25 + stop-words + per-doc MMR-lite

- BM25 (`minisearch`) over per-page chunks.
- `processTerm` drops common function words (`how`, `many`, `the`, etc.)
  so answer-bearing chunks aren't down-ranked by common-word noise.
- Greedy re-ranking over a top-`k × 6` candidate pool
  (`CANDIDATE_POOL_MULTIPLIER = 6`) with per-doc penalty
  (`effective = raw / (1 + 0.35 * count_from_same_doc)`).
- `k=20` (Slice 1.2). Slice 1's `k=12` was tuned to the pre-1.2 chunker
  where each `uhbo-challenge:p1:1` chunk was a long single chunk. With
  sentence-aware chunks, the answer-bearing "37,593" chunk now ranks
  ~17 by MMR-lite score; `k=20` re-admits it. Broad "tell me about"
  queries (f09) also need the wider net to reach `fp:p4:3` (the
  `$149.5 million` sentence). `PER_DOC_PENALTY` was reduced from 0.7
  to 0.35 for the same reason: with more, shorter chunks per doc, the
  old penalty crowded answer-bearing chunks out.

## Prompt caching and cost

- The system prompt and the passages block carry `cache_control: ephemeral`,
  so the first and retry turns share a cache prefix (byte-identical up
  through the passages). Repeat runs of the same question hit the cache.
- Every response captures `usage` (input, output, cache creation, cache
  read) into `GroundedResult`.
- `pnpm eval` prints per-fixture `in=/cached=/out=` and a line-three cost
  summary. Single-source price table: `claude-sonnet-5` at $2/$10 per
  MTok, cache write $2.50, cache read $0.20.

Cost lesson (2026-09-15): iterating on one fixture with the full 10-fixture
run burned about $20 of API spend in a day of tuning. Between gates, use
`pnpm eval --only <id>[,<id>...]`. The full suite is the greenlight check,
not the tuning loop. A gate is three consecutive full runs, about $0.30
with caching.

## `temperature` removed from Anthropic call

`claude-sonnet-5` returns `400 invalid_request_error: temperature is
deprecated for this model.` The forced tool schema, `k=12`, and small
answer surface keep behavior stable without it.

## Passage-label re-attribution (open observation)

Two of three citations on the deployed challenge question were
re-attributed to a different passage than the one the model labeled.
Open question: would numbered passage labels (`[1]..[12]`) reduce
mis-labeled citations? Measure re-attributed counts over three eval runs
with each labeling before changing anything.

## Bullet-list quotes and segment-level verification

The retry-mechanism suspicion was wrong: the failure was verification
granularity. On the challenge-process-dates question (f03), a first-turn
citation would quote a whole bullet list from `fp:p16:2` or `cpg:p5:2`
— three items separated by `●` or newlines — and the model would
sometimes paraphrase one item (e.g., collapse a date range or swap
"Rebuttal Phase" for "Rebuttal Period"). The whole-quote substring
check treated that as a total miss; the sentence-trim fallback couldn't
carve out the good items because bullets sit inside a single "sentence"
(no `.`/`;`/`?`/`!` between them).

Fix (Slice 1.2 addendum): **segment-level verification.** `verifyCitations`
now splits the quote on sentence boundaries AND list-item boundaries
(newlines; `● • ○ ▪`; a segment-leading `-` or `–`), then walks each
retrieved chunk counting how many segments (≥15 normalized chars) are
verbatim substrings of it. It picks the chunk with the most matching
segments (ties: retrieval order), keeps the citation if at least one
segment matches, and rewrites `quote` to the matched segments in their
original order joined by `" … "`, with `trimmed: true` and the correct
`passage_id`. The longest-contiguous-run trim is the special case where
every segment matches — it fell out naturally and replaces the old
`bestSentenceTrim`.

Retry mechanism (subset rule, one retry, `MAX_TOKENS`) is unchanged.
`f03` now passes five consecutive `pnpm eval --only f03` runs where
previously it flaked on ~1 in 3.
