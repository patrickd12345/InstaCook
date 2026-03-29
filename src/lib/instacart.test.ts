import { describe, expect, it } from "vitest";

import {
  buildInstacartBulkSearchUrl,
  buildInstacartLinks,
  buildInstacartSearchUrl,
  normalizeIngredientForShopping,
} from "@/lib/instacart";
import type { CanonicalRecipe } from "@/lib/recipe-schema";

const baseRecipe: CanonicalRecipe = {
  title: "Test Recipe",
  source_url: "https://example.com/recipe",
  source_name: "example.com",
  description: null,
  servings: null,
  prep_time_minutes: null,
  cook_time_minutes: null,
  total_time_minutes: null,
  ingredients: [],
  steps: [],
  tags: [],
  meal_type: null,
  cuisine: null,
  confidence: 0.5,
  extraction_warnings: [],
};

describe("buildInstacartSearchUrl", () => {
  it("encodes query string", () => {
    const url = buildInstacartSearchUrl("green onion");
    expect(url).toContain(encodeURIComponent("green onion"));
  });
});

describe("normalizeIngredientForShopping", () => {
  it("strips leading quantity and unit", () => {
    expect(normalizeIngredientForShopping("1 cup rice")).toBe("rice");
  });

  it("keeps multi-word ingredient nouns", () => {
    expect(normalizeIngredientForShopping("2 tbsp olive oil")).toBe("olive oil");
  });

  it("handles fractions and decimals", () => {
    expect(normalizeIngredientForShopping("1/2 lb ground beef")).toBe(
      "ground beef",
    );
    expect(normalizeIngredientForShopping("1.5 cups spinach")).toBe("spinach");
  });

  it("returns null for empty results", () => {
    expect(normalizeIngredientForShopping("1 cup")).toBeNull();
    expect(normalizeIngredientForShopping("   ")).toBeNull();
  });
});

describe("buildInstacartLinks", () => {
  it("dedupes by normalized query string", () => {
    const recipe: CanonicalRecipe = {
      ...baseRecipe,
      ingredients: [
        {
          raw: "1 cup rice",
          amount: 1,
          unit: "cup",
          item: "1 cup rice",
          notes: null,
        },
        { raw: "rice", amount: null, unit: null, item: "rice", notes: null },
      ],
    };
    const links = buildInstacartLinks(recipe);
    expect(links).toHaveLength(1);
    expect(links[0]!.item).toBe("rice");
  });

  it("falls back to raw when item is blank", () => {
    const recipe: CanonicalRecipe = {
      ...baseRecipe,
      ingredients: [
        { raw: "2 tbsp olive oil", amount: 2, unit: "tbsp", item: " ", notes: null },
      ],
    };
    const links = buildInstacartLinks(recipe);
    expect(links).toHaveLength(1);
    expect(links[0]!.item).toBe("olive oil");
  });

  it("encodes special characters in the URL", () => {
    const recipe: CanonicalRecipe = {
      ...baseRecipe,
      ingredients: [
        {
          raw: "Tomato & basil",
          amount: null,
          unit: null,
          item: "Tomato & basil",
          notes: null,
        },
      ],
    };
    const links = buildInstacartLinks(recipe);
    expect(links[0]!.url).toContain(
      encodeURIComponent("Tomato & basil"),
    );
  });

  it("uses normalized search values in URLs", () => {
    const recipe: CanonicalRecipe = {
      ...baseRecipe,
      ingredients: [
        { raw: "1 cup rice", amount: 1, unit: "cup", item: "1 cup rice", notes: null },
      ],
    };
    const links = buildInstacartLinks(recipe);
    expect(links[0]!.url).toContain(encodeURIComponent("rice"));
  });

  it("falls back to raw when normalization fails", () => {
    const recipe: CanonicalRecipe = {
      ...baseRecipe,
      ingredients: [
        { raw: "2 cups", amount: 2, unit: "cup", item: "2 cups", notes: null },
      ],
    };
    const links = buildInstacartLinks(recipe);
    expect(links[0]!.item).toBe("2 cups");
  });

  it("skips ingredients with blank item and raw", () => {
    const recipe: CanonicalRecipe = {
      ...baseRecipe,
      ingredients: [
        { raw: " ", amount: null, unit: null, item: " ", notes: null },
      ],
    };
    const links = buildInstacartLinks(recipe);
    expect(links).toHaveLength(0);
  });
});

describe("buildInstacartBulkSearchUrl", () => {
  it("combines normalized ingredient queries", () => {
    const recipe: CanonicalRecipe = {
      ...baseRecipe,
      ingredients: [
        { raw: "1 cup rice", amount: 1, unit: "cup", item: "1 cup rice", notes: null },
        { raw: "2 tbsp olive oil", amount: 2, unit: "tbsp", item: "2 tbsp olive oil", notes: null },
      ],
    };
    const url = buildInstacartBulkSearchUrl(recipe);
    expect(url).toBeTruthy();
    expect(url!).toContain(encodeURIComponent("rice, olive oil"));
  });

  it("dedupes repeated ingredients after normalization", () => {
    const recipe: CanonicalRecipe = {
      ...baseRecipe,
      ingredients: [
        { raw: "1 cup rice", amount: 1, unit: "cup", item: "1 cup rice", notes: null },
        { raw: "rice", amount: null, unit: null, item: "rice", notes: null },
      ],
    };
    const url = buildInstacartBulkSearchUrl(recipe);
    expect(url).toContain(encodeURIComponent("rice"));
    expect(url).not.toContain(encodeURIComponent("rice, rice"));
  });

  it("limits to the first 10 unique items", () => {
    const ingredients = Array.from({ length: 12 }, (_, i) => ({
      raw: `${i + 1} cup item${i + 1}`,
      amount: i + 1,
      unit: "cup",
      item: `${i + 1} cup item${i + 1}`,
      notes: null,
    }));
    const recipe: CanonicalRecipe = {
      ...baseRecipe,
      ingredients,
    };
    const url = buildInstacartBulkSearchUrl(recipe);
    expect(url).toBeTruthy();
    const decoded = decodeURIComponent(url!.split("q=")[1]!);
    expect(decoded.split(", ").length).toBe(10);
    expect(decoded).toContain("item10");
    expect(decoded).not.toContain("item11");
  });

  it("returns null when no usable ingredients", () => {
    const recipe: CanonicalRecipe = {
      ...baseRecipe,
      ingredients: [
        { raw: " ", amount: null, unit: null, item: " ", notes: null },
      ],
    };
    const url = buildInstacartBulkSearchUrl(recipe);
    expect(url).toBeNull();
  });
});
