import { describe, expect, it } from "vitest";

import { mergeAndValidateCanonicalRecipe } from "@/lib/recipe-normalize";
import type { CanonicalRecipeModelOutput } from "@/lib/recipe-schema";

const modelOk: CanonicalRecipeModelOutput = {
  title: "Merged Soup",
  description: null,
  servings: 2,
  prep_time_minutes: null,
  cook_time_minutes: null,
  total_time_minutes: null,
  ingredients: [
    {
      raw: "1 tsp salt",
      amount: 1,
      unit: "tsp",
      item: "salt",
      notes: null,
    },
  ],
  steps: [{ order: 1, text: "Stir." }],
  tags: [],
  meal_type: null,
  cuisine: null,
  confidence: 0.5,
  extraction_warnings: [],
};

describe("mergeAndValidateCanonicalRecipe", () => {
  it("overrides source fields from server metadata", () => {
    const parsed = mergeAndValidateCanonicalRecipe(
      modelOk,
      "https://ricardocuisine.com/recipes/1",
      "ricardocuisine.com",
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.source_url).toBe("https://ricardocuisine.com/recipes/1");
      expect(parsed.data.source_name).toBe("ricardocuisine.com");
      expect(parsed.data.title).toBe("Merged Soup");
    }
  });

  it("rejects invalid model output (confidence)", () => {
    const parsed = mergeAndValidateCanonicalRecipe(
      { ...modelOk, confidence: 2 },
      "https://bonappetit.com/r",
      "bonappetit.com",
    );
    expect(parsed.success).toBe(false);
  });

  it("rejects empty title", () => {
    const parsed = mergeAndValidateCanonicalRecipe(
      { ...modelOk, title: "" },
      "https://bonappetit.com/r",
      "bonappetit.com",
    );
    expect(parsed.success).toBe(false);
  });
});
