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
    expect(dropped).toBe(0);
  });

  it("reattributes when the quote is in exactly one other retrieved chunk", () => {
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
    expect(dropped).toBe(0);
  });

  it("drops a paraphrase not present verbatim in any retrieved chunk", () => {
    const { verified, dropped } = verifyCitations(
      [{ passage_id: "uhbo-challenge:p1:1", quote: "the office reported 37,593 filings" }],
      retrieved,
    );
    expect(verified.length).toBe(0);
    expect(dropped).toBe(1);
  });

  it("drops a citation with too-short normalized quote", () => {
    const { verified, dropped } = verifyCitations(
      [{ passage_id: "uhbo-challenge:p1:1", quote: "37,593" }],
      retrieved,
    );
    expect(verified.length).toBe(0);
    expect(dropped).toBe(1);
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
