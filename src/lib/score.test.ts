import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatPoints,
  scoreOfferors,
  speedToDeploymentPoints,
} from "./score";
import type { PageFile } from "./types";

const page = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "data/pages/selection.json"),
    "utf8",
  ),
) as PageFile;

describe("scoreOfferors", () => {
  if (!page.calculator) throw new Error("selection.json missing calculator");
  const scored = scoreOfferors(page.calculator.defaults);
  const byId = new Map(scored.map((s) => [s.id, s]));

  for (const exp of page.calculator.expected) {
    it(`matches the Final Proposal example for ${exp.id}`, () => {
      const [field, offerorId] = exp.id.split("-");
      const s = byId.get(offerorId);
      expect(s, `offeror ${offerorId} not scored`).toBeDefined();
      const got = (s as Record<string, string>)[field];
      expect(got).toBe(exp.value);
    });
  }
});

describe("speedToDeploymentPoints", () => {
  it("returns null when months exceeds the 48-month horizon", () => {
    expect(speedToDeploymentPoints(60, 48, 30)).toBeNull();
  });
});

describe("formatPoints", () => {
  it("strips trailing zeros and dot at one decimal", () => {
    expect(formatPoints(80, 1)).toBe("80");
    expect(formatPoints(57.142857, 1)).toBe("57.1");
    expect(formatPoints(15, 2)).toBe("15");
    expect(formatPoints(11.25, 2)).toBe("11.25");
  });
});
