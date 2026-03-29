import { describe, expect, it } from "vitest";

import { RecipeService } from "@/lib/recipe-service";

describe("RecipeService", () => {
  const service = new RecipeService(42);

  it("finds recipes by keyword", () => {
    const found = service.findRecipe("curry");
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]!.title).toBe("Chickpea Curry");
  });

  it("builds menu plan with correct length", () => {
    const plan = service.buildMenuPlan({
      start_date: "2026-03-29",
      days: 7,
      meals_per_day: ["breakfast", "dinner"],
    });
    expect(plan.days).toBe(7);
    expect(plan.daily_plans).toHaveLength(7);
  });

  it("builds Instacart URL with encoded items", () => {
    const url = service.instacartCheckoutUrl([
      { name: "Garlic", quantity: 2, unit: "clove" },
      { name: "Spinach", quantity: 1, unit: "bag" },
    ]);
    expect(url).toContain("instacart.com");
    expect(url).toContain(encodeURIComponent("Garlic"));
  });

  it("merges ingredient quantities by name and unit", () => {
    const recipes = service.listRecipes().filter((r) => r.id === "r1");
    const summary = service.summarizeIngredients(recipes);
    const garlic = summary.items.find((i) => i.name === "Garlic");
    expect(garlic?.quantity).toBe(4);
  });
});
