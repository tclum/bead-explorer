import { describe, it, expect } from "vitest";
import { normalize } from "./normalize";

describe("normalize", () => {
  it("collapses okina and apostrophe variants", () => {
    expect(normalize("Hawaiʻi")).toBe(normalize("Hawai'i"));
    expect(normalize("Hawai'i")).toBe(normalize("Hawai’i"));
    expect(normalize("Hawaiʻi")).toBe(normalize("Hawai‘i"));
    expect(normalize("Hawaiʻi")).toBe("hawaii");
  });

  it("treats en-dash and hyphen equal", () => {
    expect(normalize("Received – 37,593")).toBe(normalize("Received - 37,593"));
    expect(normalize("Received — 37,593")).toBe(normalize("Received - 37,593"));
  });

  it("collapses internal line breaks", () => {
    expect(normalize("Total\nChallenges\nReceived")).toBe("total challenges received");
    expect(normalize("Total  \n  Challenges")).toBe("total challenges");
  });

  it("normalizes curly double quotes", () => {
    expect(normalize("said “hello”")).toBe('said "hello"');
  });

  it("lowercases and strips leading/trailing whitespace", () => {
    expect(normalize("  ALLOCATION  ")).toBe("allocation");
  });
});
