import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  searchPublisherRecipes: vi.fn(),
  fetchTrustedRecipePage: vi.fn(),
  normalizeExtractedPage: vi.fn(),
}));

vi.mock("@/lib/recipe-web-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/recipe-web-search")>();
  return {
    ...actual,
    searchPublisherRecipes: mocks.searchPublisherRecipes,
  };
});

vi.mock("@/lib/recipe-page-fetch", () => ({
  fetchTrustedRecipePage: mocks.fetchTrustedRecipePage,
}));

vi.mock("@/lib/recipe-normalize", () => ({
  normalizeExtractedPage: mocks.normalizeExtractedPage,
}));

import { searchRecipesWithWebAndAi } from "@/lib/recipe-search";

describe("searchRecipesWithWebAndAi", () => {
  beforeEach(() => {
    mocks.searchPublisherRecipes.mockResolvedValue({
      hits: [
        {
          title: "T Example",
          url: "https://bonappetit.com/recipe/example",
          snippet: "Snip",
          displayLink: "bonappetit.com",
        },
      ],
    });
    mocks.fetchTrustedRecipePage.mockResolvedValue({
      ok: true,
      url: "https://bonappetit.com/recipe/example",
      html: "<html><head><title>T</title></head><body>Hi</body></html>",
    });
    mocks.normalizeExtractedPage.mockResolvedValue({
      recipe: null,
      warnings: ["AI normalization failed: mock"],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns web hits when normalization fails (no hard failure)", async () => {
    const out = await searchRecipesWithWebAndAi("curry");
    expect(out.web.length).toBe(1);
    expect(out.recipes).toEqual([]);
    expect(out.warnings.some((w) => w.includes("normalization failed"))).toBe(
      true,
    );
  });

  it("returns normalized recipes when normalize succeeds", async () => {
    mocks.normalizeExtractedPage.mockResolvedValue({
      recipe: {
        title: "Soup",
        source_url: "https://bonappetit.com/recipe/example",
        source_name: "bonappetit.com",
        description: null,
        servings: null,
        prep_time_minutes: null,
        cook_time_minutes: null,
        total_time_minutes: null,
        ingredients: [
          {
            raw: "1 x",
            amount: null,
            unit: null,
            item: "x",
            notes: null,
          },
        ],
        steps: [{ order: 1, text: "Do." }],
        tags: [],
        meal_type: null,
        cuisine: null,
        confidence: 0.6,
        extraction_warnings: [],
      },
      warnings: [],
    });

    const out = await searchRecipesWithWebAndAi("soup");
    expect(out.recipes).toHaveLength(1);
    expect(out.recipes[0]?.title).toBe("Soup");
    expect(out.web.length).toBe(1);
  });
});
