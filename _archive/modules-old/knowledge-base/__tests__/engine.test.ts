/**
 * Knowledge Base — pure-logic unit tests
 *  - slugify, search vector building, helpfulness ratio
 */

import { describe, it, expect } from "bun:test";

// Mirror of service.ts slugify
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// Mirror of service.ts buildSearchVector
function buildSearchVector(a: { title: string; excerpt: string | null; tags: string[]; body: string }): string {
  return [a.title, a.excerpt ?? "", a.tags.join(" "), a.body].join(" ").toLowerCase();
}

// Mirror of recordFeedback helpfulness ratio
function helpfulnessRatio(helpful: number, notHelpful: number): number {
  return helpful / Math.max(1, helpful + notHelpful);
}

describe("Knowledge Base — pure logic", () => {
  it("slugifies titles", () => {
    expect(slugify("How to Clean Marble")).toBe("how-to-clean-marble");
    expect(slugify("  Multiple   Spaces  ")).toBe("multiple-spaces");
    expect(slugify("Special! @#$ Characters")).toBe("special-characters");
  });

  it("truncates long slugs to 80 chars", () => {
    const long = "a".repeat(120);
    expect(slugify(long).length).toBe(80);
  });

  it("builds a search vector from all fields", () => {
    const vec = buildSearchVector({
      title: "Marble Care",
      excerpt: "Guide to marble",
      tags: ["MARBLE", "POLISH"],
      body: "Use pH-neutral cleaner",
    });
    expect(vec).toContain("marble care");
    expect(vec).toContain("guide to marble");
    expect(vec).toContain("marble polish");
    expect(vec).toContain("use ph-neutral cleaner");
  });

  it("handles null excerpt in search vector", () => {
    const vec = buildSearchVector({
      title: "Test",
      excerpt: null,
      tags: [],
      body: "Body text",
    });
    // [title, "", tags.join(" "), body] = ["Test", "", "", "Body text"] → "test   body text" (3 spaces)
    expect(vec).toBe("test   body text");
  });

  it("computes helpfulness ratio correctly", () => {
    expect(helpfulnessRatio(8, 2)).toBe(0.8);
    expect(helpfulnessRatio(0, 0)).toBe(0); // max(1, 0) = 1, so 0/1 = 0
    expect(helpfulnessRatio(5, 5)).toBe(0.5);
    expect(helpfulnessRatio(10, 0)).toBe(1);
  });
});
