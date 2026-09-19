# bead-explorer: standing rules for agents

Rev 2026-09-18b. These rules apply in every session and every slice. A prompt may add to them, never relax them.

## Hard rules
- Public data only. Never invent a number. Every figure on a page lives in a committed data file (`data/status.json`, `data/pages/<page>.json`, or a CSV under `data/`) with a receipt the eval checks against the corpus.
- No vendor names anywhere in the repo, the site, commit messages, or docs. No ProService, Forpono, or DDO content. The Anthropic key stays server-side.
- Navigation lists shipped pages only. Anything computed rather than quoted is labeled computed and is unit-tested against the source's own worked examples.

## Git
- Stage by explicit path. Never `git add -A`, `git add .`, or `git add :/`.
- Never push. Commit only after Tim's explicit greenlight at the gate; a commit message in a prompt is not a greenlight.
- If a hook refuses a command, stop and report. A refusal is final.

## Eval and smoke
- Tune with `pnpm eval --only <id> [--repeat N]`. The full suite runs at the gate. Report every run you execute, in order, with no re-rolls.
- A change to retrieval, chunking, the system prompt, or verification needs three consecutive full greens.
- A full-run failure on exactly one fixture with retrieval=ok, in a slice that changed none of `src/lib/ground.ts`, `retrieve.ts`, `verify.ts`, `chunk.ts`, or the corpus, is re-tested with `pnpm eval --only <id> --repeat 5`. Five of five green passes the gate and the flake is logged in `docs/project-state.md` with the date, fixture, and failure text. Any other pattern is a failure.
- Fixtures are corrected only to match the corpus, never edited to pass; say which one moved and why.
- `pnpm smoke <url>` after every deploy; a run whose deployed SHA differs from local HEAD does not count.

## docs/project-state.md
- Exactly these sections, in this order: Destination, Shipped, Do, Deploy, Do not touch, Open questions, Not yet specified, Accepted gaps, Out of scope.
- Never remove a section, an Accepted-gaps line, or an Out-of-scope line. Keep the file at or under 110 lines by condensing Shipped entries.
- Paste the full file and `git diff --cached docs/project-state.md` at every gate.

## Docs ride with the change
- README, `data/README.md`, `docs/walkthrough.md`, and `docs/project-state.md` are updated in the same commit as the change they describe. A change with no doc impact says so in the gate report.
