# Three-minute walkthrough

Doc rev 2026-09-19a.

1. Open the site. Read the header line and the disclaimer. The whole page is built from eleven public documents and two public datasets; the corpus list at the bottom shows each one's hash and fetch time.
2. Expand the receipt on the "BEAD allocation" tile. The quote is the sentence from Initial Proposal Volume 2, page 105 (PDF page), and the link opens the PDF at that page.
3. Click "Challenge process dates". The answer states the three phase windows; each date sits inside a verbatim quote from the Final Proposal, page 16. Open "Retrieved passages" to see what the model was given.
4. Click "Locations connected so far". The documents do not report construction progress, so the answer is a refusal that says what the corpus does cover. No figure appears in a refusal.
5. Ask "Tell me about the BEAD program." A broad question: the answer is grounded, and if the model volunteered a figure it could not cite, a line under the answer says how many figures were withheld.
6. Scroll to "Where the gaps are". Two series, two vintages, deliberately not combined: FCC's Dec 31, 2025 availability tiers beside the Dec 31, 2024 fabric NTIA approved for BEAD funding.
7. In a terminal in the repo, run `pnpm eval --selftest`. Line one is `RESULT: pass` because every deliberately broken case went red. Run `pnpm smoke https://bead.forpono.com`: line two prints the deployed and local commit SHAs, and the probes only count if they match.
8. Open `/challenge`. Read the three sum lines under the breakdown tables: two breakdowns match the stated total of 37,593; the challenge-type breakdown does not — its six published row counts sum to 37,595, and the page says so in amber.
9. Open `/selection`. Scroll to "Run the published formula" and change Offeror B's requested funding from 25 to 30; Part 1 for B drops from 80 to 66.7 and Offeror A becomes the best-scored on that column. Press "Reset to the Final Proposal's examples" and the document's own numbers — 100, 80, 57.1 down the Part 1 column — return.
10. Open `/oversight`. Read the risk tiers: what puts a subgrantee into medium or high risk, and what that changes in site-visit frequency, desk reviews, and reimbursement.
11. Open `/report` and press "Print or save as PDF". The print preview is light, receipts are inline (no expand-to-see), and the build SHA is on the first line so the printout is versioned.
