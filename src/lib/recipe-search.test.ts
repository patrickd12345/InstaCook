import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  searchPublisherRecipes: vi.fn(),
  fetchTrustedRecipePage: vi.fn(),
  normalizeExtractedPage: vi.fn(),
  normalizeSearchHit: vi.fn(),
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
  normalizeSearchHit: mocks.normalizeSearchHit,
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
    mocks.normalizeSearchHit.mockResolvedValue({
      recipe: null,
      warnings: ["AI normalization failed: fallback mock"],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns web hits when normalization fails (no hard failure)", async () => {
    const out = await searchRecipesWithWebAndAi("websearchonlyquery");
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

  it("uses AI fallback when fetch fails", async () => {
    mocks.fetchTrustedRecipePage.mockResolvedValue({
      ok: false,
      url: "https://bonappetit.com/recipe/example",
      error: "HTTP 403",
    });
    mocks.normalizeSearchHit.mockResolvedValue({
      recipe: {
        title: "Fallback Spaghetti",
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
        confidence: 0.2,
        extraction_warnings: ["AI inferred from snippet."],
      },
      warnings: ["AI inferred from snippet."],
    });

    const out = await searchRecipesWithWebAndAi("spaghetti");
    expect(out.recipes).toHaveLength(1);
    expect(out.recipes[0]?.title).toBe("Fallback Spaghetti");
    expect(out.warnings.some((w) => w.includes("Fetch"))).toBe(true);
  });

  it("returns spaghetti-related web hits for a spaghetti query", async () => {
    mocks.searchPublisherRecipes.mockResolvedValue({
      hits: [
        {
          title: "28 Best Spaghetti Recipes | Food Network",
          url: "https://www.foodnetwork.com/recipes/photos/spaghetti-recipes",
          snippet:
            "Whether traditional or saucy, these spaghetti recipes are crowd-pleasers.",
          displayLink: "www.foodnetwork.com",
        },
      ],
    });
    mocks.fetchTrustedRecipePage.mockResolvedValue({
      ok: false,
      url: "https://www.foodnetwork.com/recipes/photos/spaghetti-recipes",
      error: "HTTP 403",
    });
    mocks.normalizeSearchHit.mockResolvedValue({ recipe: null, warnings: [] });

    const out = await searchRecipesWithWebAndAi("spaghetti");
    expect(out.query).toBe("spaghetti");
    expect(out.web).toHaveLength(1);
    const combined = `${out.web[0]!.title} ${out.web[0]!.snippet}`.toLowerCase();
    expect(combined).toContain("spaghetti");
  });

  it("skips web search and AI when the catalog already has matches (no extra API usage)", async () => {
    const out = await searchRecipesWithWebAndAi("curry");
    expect(out.local.length).toBeGreaterThan(0);
    expect(out.local[0]?.title).toContain("Curry");
    expect(out.web).toEqual([]);
    expect(out.recipes).toEqual([]);
    expect(out.warnings).toEqual([]);
    expect(mocks.searchPublisherRecipes).not.toHaveBeenCalled();
    expect(mocks.fetchTrustedRecipePage).not.toHaveBeenCalled();
    expect(mocks.normalizeExtractedPage).not.toHaveBeenCalled();
    expect(mocks.normalizeSearchHit).not.toHaveBeenCalled();
  });
});
