import { describe, expect, it } from "vitest";

import {
  canonicalRecipeSchema,
  isSubstantialCanonicalRecipe,
} from "@/lib/recipe-schema";

const validMinimal = {
  title: "Test Soup",
  source_url: "https://bonappetit.com/recipe/test",
  source_name: "bonappetit.com",
  description: null,
  servings: null,
  prep_time_minutes: null,
  cook_time_minutes: null,
  total_time_minutes: null,
  ingredients: [
    {
      raw: "1 cup water",
      amount: 1,
      unit: "cup",
      item: "water",
      notes: null,
    },
  ],
  steps: [{ order: 1, text: "Boil." }],
  tags: [],
  meal_type: null,
  cuisine: null,
  confidence: 0.4,
  extraction_warnings: ["Times not listed on page."],
};

describe("canonicalRecipeSchema", () => {
  it("accepts valid recipe with nulls", () => {
    const r = canonicalRecipeSchema.parse(validMinimal);
    expect(r.title).toBe("Test Soup");
    expect(r.servings).toBeNull();
    expect(r.ingredients[0]?.amount).toBe(1);
  });

  it("accepts null meal_type and optional fields", () => {
    const r = canonicalRecipeSchema.parse({
      ...validMinimal,
      meal_type: "dinner",
      cuisine: "Italian",
    });
    expect(r.meal_type).toBe("dinner");
  });

  it("rejects confidence out of range", () => {
    const bad = { ...validMinimal, confidence: 1.5 };
    const r = canonicalRecipeSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects invalid meal_type", () => {
    const bad = { ...validMinimal, meal_type: "brunch" };
    const r = canonicalRecipeSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects invalid source_url", () => {
    const bad = { ...validMinimal, source_url: "not-a-url" };
    const r = canonicalRecipeSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });
});

describe("isSubstantialCanonicalRecipe", () => {
  it("returns false when no ingredients and no steps", () => {
    const r = canonicalRecipeSchema.parse({
      ...validMinimal,
      ingredients: [],
      steps: [],
    });
    expect(isSubstantialCanonicalRecipe(r)).toBe(false);
  });

  it("returns true when ingredients present", () => {
    expect(isSubstantialCanonicalRecipe(canonicalRecipeSchema.parse(validMinimal))).toBe(
      true,
    );
  });
});
