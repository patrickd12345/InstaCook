import { describe, expect, it } from "vitest";

import {
  buildPublisherSearchQuery,
  DEFAULT_RECIPE_SEARCH_SITES,
  isTrustedRecipeUrl,
  normalizeRecipeHost,
} from "@/lib/recipe-web-search";

describe("buildPublisherSearchQuery", () => {
  it("combines user query with site filters", () => {
    const q = buildPublisherSearchQuery("chicken curry", [
      "bonappetit.com",
      "ricardocuisine.com",
    ]);
    expect(q).toContain("chicken curry");
    expect(q).toContain("site:bonappetit.com");
    expect(q).toContain("site:ricardocuisine.com");
    expect(q).toContain(" OR ");
  });

  it("uses default publisher list", () => {
    const q = buildPublisherSearchQuery("pasta");
    for (const site of DEFAULT_RECIPE_SEARCH_SITES) {
      expect(q).toContain(`site:${site}`);
    }
  });
});

describe("normalizeRecipeHost", () => {
  it("strips www prefix", () => {
    expect(normalizeRecipeHost("WWW.BonAppetit.COM")).toBe("bonappetit.com");
  });
});

describe("isTrustedRecipeUrl", () => {
  it("allows https on allowlisted host", () => {
    expect(isTrustedRecipeUrl("https://www.bonappetit.com/recipe/foo")).toBe(true);
    expect(isTrustedRecipeUrl("https://bonappetit.com/recipe/foo")).toBe(true);
  });

  it("rejects non-https", () => {
    expect(isTrustedRecipeUrl("http://bonappetit.com/r")).toBe(false);
  });

  it("rejects untrusted host", () => {
    expect(isTrustedRecipeUrl("https://evil.com/recipe")).toBe(false);
  });

  it("rejects malformed URL", () => {
    expect(isTrustedRecipeUrl("not a url")).toBe(false);
  });
});
