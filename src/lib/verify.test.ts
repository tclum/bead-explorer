import { describe, it, expect } from "vitest";
import { verifyCitations, extractNumbers, numbersCovered } from "./verify";
import type { RetrievedChunk } from "./types";

const retrieved: RetrievedChunk[] = [
  {
    id: "uhbo-challenge:p1:1",
    doc: "uhbo-challenge",
    page: 1,
    score: 1,
    text: "Total Challenges Received – 37,593. This was the count reported by the Hawaiʻi Broadband Office after adjudication.",
    url: "https://example.com/",
    page_url: "https://example.com/",
  },
  {
    id: "fp:p16:2",
    doc: "fp",
    page: 16,
    score: 0.5,
    text: "Challenge Phase: August 19, 2024 to September 18, 2024. Final Determination Phase: November 7, 2024 to December 7, 2024.",
    url: "https://example.com/fp",
    page_url: "https://example.com/fp#page=16",
  },
];

describe("verifyCitations", () => {
  it("accepts a quote with whitespace and quote-style differences", () => {
    const { verified, dropped } = verifyCitations(
      [{ passage_id: "uhbo-challenge:p1:1", quote: "Received - 37,593" }],
      retrieved,
    );
    expect(verified.length).toBe(1);
    expect(verified[0].reattributed).toBe(false);
    expect(verified[0].trimmed).toBe(false);
    expect(dropped).toEqual([]);
  });

  it("reattributes when the quote is in another retrieved chunk", () => {
    const { verified, dropped } = verifyCitations(
      [
        {
          passage_id: "uhbo-challenge:p1:1",
          quote: "Challenge Phase: August 19, 2024 to September 18, 2024",
        },
      ],
      retrieved,
    );
    expect(verified.length).toBe(1);
    expect(verified[0].passage_id).toBe("fp:p16:2");
    expect(verified[0].reattributed).toBe(true);
    expect(verified[0].trimmed).toBe(false);
    expect(dropped).toEqual([]);
  });

  it("reattributes to first in retrieval order when the quote is in multiple chunks", () => {
    const dup: RetrievedChunk[] = [
      { ...retrieved[0], id: "a:p1:1", doc: "a", text: "Shared line X exactly here." },
      { ...retrieved[0], id: "b:p1:1", doc: "b", text: "Shared line X exactly here." },
      { ...retrieved[0], id: "c:p1:1", doc: "c", text: "Shared line X exactly here." },
    ];
    const { verified, dropped } = verifyCitations(
      [{ passage_id: "b:p1:1", quote: "Shared line X exactly here" }],
      dup,
    );
    expect(verified.length).toBe(1);
    // Labeled chunk matches directly — no re-attribution needed.
    expect(verified[0].passage_id).toBe("b:p1:1");
    expect(verified[0].reattributed).toBe(false);
    expect(dropped).toEqual([]);
    // Now check a labeled miss: pick first in retrieval order (a, not c).
    const r2 = verifyCitations(
      [{ passage_id: "z:p1:1", quote: "Shared line X exactly here" }],
      dup,
    );
    expect(r2.verified[0].passage_id).toBe("a:p1:1");
    expect(r2.verified[0].reattributed).toBe(true);
  });

  it("sentence-trims to the verbatim run when the full quote is not verbatim", () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "z:p1:1",
        doc: "z",
        page: 1,
        score: 1,
        text: "Hawaiʻi will see approximately $149.5 million. Deployment begins next year.",
        url: "https://example.com/z",
        page_url: "https://example.com/z",
      },
    ];
    const quote = "Hawaiʻi will see approximately $149.5 million. Something imagined by the model here.";
    const { verified, dropped } = verifyCitations(
      [{ passage_id: "z:p1:1", quote }],
      chunks,
    );
    expect(verified.length).toBe(1);
    expect(verified[0].trimmed).toBe(true);
    expect(verified[0].quote).toBe("Hawaiʻi will see approximately $149.5 million.");
    expect(dropped).toEqual([]);
  });

  it("segment-trims a bullet-list quote to the matched items joined by ' … '", () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "z:p1:1",
        doc: "z",
        page: 1,
        score: 1,
        text: "Challenge Phase (August 19, 2024 - September 18, 2024) ● Rebuttal Phase (October 7, 2024 - November 6, 2024) ● Final Determination Phase (November 7, 2024 - December 7, 2024)",
        url: "https://example.com/z",
        page_url: "https://example.com/z",
      },
    ];
    const quote =
      "Challenge Phase (August 19, 2024 - September 18, 2024) ● Rebuttal Phase (Oct 7 to Nov 6) ● Final Determination Phase (November 7, 2024 - December 7, 2024)";
    const { verified, dropped } = verifyCitations(
      [{ passage_id: "z:p1:1", quote }],
      chunks,
    );
    expect(verified.length).toBe(1);
    expect(verified[0].trimmed).toBe(true);
    expect(verified[0].quote).toBe(
      "Challenge Phase (August 19, 2024 - September 18, 2024) … Final Determination Phase (November 7, 2024 - December 7, 2024)",
    );
    expect(dropped).toEqual([]);
  });

  it("drops the paraphrased segment and keeps only the verbatim one", () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "z:p1:1",
        doc: "z",
        page: 1,
        score: 1,
        text: "Total Challenges Received - 37,593. Service Provider Challenges Received - 12,719.",
        url: "https://example.com/z",
        page_url: "https://example.com/z",
      },
    ];
    // First segment matches; second is paraphrased ("providers submitted" vs. "Service Provider Challenges Received").
    const quote = "Total Challenges Received - 37,593. Providers submitted 12,719 of them.";
    const { verified, dropped } = verifyCitations(
      [{ passage_id: "z:p1:1", quote }],
      chunks,
    );
    expect(verified.length).toBe(1);
    expect(verified[0].trimmed).toBe(true);
    expect(verified[0].quote).toBe("Total Challenges Received - 37,593.");
    expect(dropped).toEqual([]);
  });

  it("drops a paraphrase not present verbatim in any retrieved chunk", () => {
    const { verified, dropped } = verifyCitations(
      [{ passage_id: "uhbo-challenge:p1:1", quote: "the office reported 37,593 filings" }],
      retrieved,
    );
    expect(verified.length).toBe(0);
    expect(dropped).toEqual([
      { passage_id: "uhbo-challenge:p1:1", quote: "the office reported 37,593 filings", reason: "not_found" },
    ]);
  });

  it("drops a citation with too-short normalized quote", () => {
    const { verified, dropped } = verifyCitations(
      [{ passage_id: "uhbo-challenge:p1:1", quote: "37,593" }],
      retrieved,
    );
    expect(verified.length).toBe(0);
    expect(dropped).toEqual([
      { passage_id: "uhbo-challenge:p1:1", quote: "37,593", reason: "too_short" },
    ]);
  });
});

describe("extractNumbers", () => {
  it("extracts integers, decimals, and comma-grouped numbers", () => {
    expect(extractNumbers("37,593 challenges at $149,484,493.57 with 81.7% fiber")).toEqual([
      "37593",
      "149484493.57",
      "81.7",
    ]);
  });

  it("keeps dates as separate numbers", () => {
    expect(extractNumbers("November 18, 2025 approval")).toEqual(["18", "2025"]);
  });

  it("returns an empty list when no numbers are present", () => {
    expect(extractNumbers("no digits here")).toEqual([]);
  });
});

describe("numbersCovered", () => {
  it("accepts a number that appears verbatim in a quote", () => {
    const r = numbersCovered("The total was 37,593.", ["Total Challenges Received - 37,593"]);
    expect(r.uncovered).toEqual([]);
  });

  it("flags a number that is missing from every quote", () => {
    const r = numbersCovered(
      "The total was 37,593, with 12,719 from providers.",
      ["Total Challenges Received - 37,593"],
    );
    expect(r.uncovered).toEqual(["12719"]);
  });

  it("does not match a supernumber (12345 does not cover 234)", () => {
    const r = numbersCovered("The count is 234.", ["some other value 12345 present"]);
    expect(r.uncovered).toEqual(["234"]);
  });

  it("accepts decimals with a decimal-boundary check", () => {
    const r = numbersCovered("Fiber share was 81.7% of the total.", ["with 81.7% fiber-to-the-premises"]);
    expect(r.uncovered).toEqual([]);
  });
});
