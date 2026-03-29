import type { z } from "zod";
import {
  ingredientSummaryItemSchema,
  instacartExportRequestSchema,
  menuPlanRequestSchema,
  type MealType,
  type Recipe,
} from "@/lib/schemas";

type IngredientSummaryItem = z.infer<typeof ingredientSummaryItemSchema>;

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSeeded<T>(arr: T[], rng: () => number): T {
  const i = Math.floor(rng() * arr.length);
  return arr[i]!;
}

function addDaysIso(isoDate: string, offset: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function formatQuantityGeneral(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(10).replace(/\.?0+$/, "");
  return s;
}

export class RecipeService {
  private readonly rng: () => number;
  private readonly recipes: Recipe[];

  constructor(randomSeed = 42) {
    this.rng = mulberry32(randomSeed);
    this.recipes = RecipeService.seedRecipes();
  }

  listRecipes(): Recipe[] {
    return this.recipes;
  }

  randomRecipe(mealType?: MealType | null): Recipe {
    const choices = this.recipes.filter(
      (r) => mealType == null || r.meal_type === mealType,
    );
    return pickSeeded(choices, this.rng);
  }

  findRecipe(query: string): Recipe[] {
    const normalized = query.toLowerCase();
    return this.recipes.filter(
      (recipe) =>
        recipe.title.toLowerCase().includes(normalized) ||
        recipe.description.toLowerCase().includes(normalized),
    );
  }

  buildMenuPlan(raw: unknown) {
    const request = menuPlanRequestSchema.parse(raw);
    const daily_plans = [];
    for (let offset = 0; offset < request.days; offset++) {
      const date = addDaysIso(request.start_date, offset);
      const meals: Record<MealType, Recipe> = {} as Record<MealType, Recipe>;
      for (const mealType of request.meals_per_day) {
        meals[mealType] = this.randomRecipe(mealType);
      }
      daily_plans.push({ date, meals });
    }
    return {
      start_date: request.start_date,
      days: request.days,
      daily_plans,
    };
  }

  summarizeIngredients(recipes: Recipe[]) {
    const grouped = new Map<string, { name: string; unit: string; quantity: number }>();
    for (const recipe of recipes) {
      for (const ing of recipe.ingredients) {
        const key = `${ing.name.toLowerCase()}\0${ing.unit}`;
        const prev = grouped.get(key);
        if (prev) {
          prev.quantity += ing.quantity;
        } else {
          grouped.set(key, {
            name: ing.name,
            unit: ing.unit,
            quantity: ing.quantity,
          });
        }
      }
    }
    const items = [...grouped.values()]
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .map((row) => ({
        name: row.name,
        unit: row.unit,
        quantity: Math.round(row.quantity * 100) / 100,
      }));
    return { items };
  }

  instacartCheckoutUrl(items: IngredientSummaryItem[]): string {
    const query = items
      .map(
        (item) =>
          `${formatQuantityGeneral(item.quantity)} ${item.unit} ${item.name}`,
      )
      .join(",");
    return `https://www.instacart.com/store/search_v3/${encodeURIComponent(query)}`;
  }

  instacartExport(raw: unknown) {
    const payload = instacartExportRequestSchema.parse(raw);
    const cart_payload = payload.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
    }));
    return {
      item_count: payload.items.length,
      cart_payload,
      checkout_url: this.instacartCheckoutUrl(payload.items),
    };
  }

  private static seedRecipes(): Recipe[] {
    return [
      {
        id: "r1",
        title: "Lemon Garlic Chicken Bowl",
        description:
          "Protein-rich dinner bowl with roasted vegetables and quinoa.",
        servings: 4,
        meal_type: "dinner",
        ingredients: [
          { name: "Chicken breast", quantity: 1.5, unit: "lb" },
          { name: "Lemon", quantity: 2, unit: "unit" },
          { name: "Garlic", quantity: 4, unit: "clove" },
          { name: "Quinoa", quantity: 1.5, unit: "cup" },
        ],
        steps: [
          "Season chicken",
          "Roast with garlic",
          "Cook quinoa",
          "Assemble bowls",
        ],
      },
      {
        id: "r2",
        title: "Creamy Overnight Oats",
        description:
          "Make-ahead oats with chia and berries for quick breakfast.",
        servings: 2,
        meal_type: "breakfast",
        ingredients: [
          { name: "Rolled oats", quantity: 1, unit: "cup" },
          { name: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { name: "Blueberries", quantity: 1, unit: "cup" },
        ],
        steps: [
          "Mix oats and yogurt",
          "Refrigerate overnight",
          "Top with berries",
        ],
      },
      {
        id: "r3",
        title: "Turkey Avocado Wrap",
        description: "Quick lunch wrap for busy weekdays.",
        servings: 2,
        meal_type: "lunch",
        ingredients: [
          { name: "Whole wheat tortilla", quantity: 4, unit: "unit" },
          { name: "Turkey slices", quantity: 0.75, unit: "lb" },
          { name: "Avocado", quantity: 2, unit: "unit" },
        ],
        steps: ["Layer ingredients", "Roll tortilla", "Slice and serve"],
      },
      {
        id: "r4",
        title: "Chickpea Curry",
        description: "Budget-friendly vegetarian curry.",
        servings: 4,
        meal_type: "dinner",
        ingredients: [
          { name: "Chickpeas", quantity: 2, unit: "can" },
          { name: "Coconut milk", quantity: 1, unit: "can" },
          { name: "Spinach", quantity: 5, unit: "oz" },
        ],
        steps: ["Simmer chickpeas", "Add coconut milk", "Fold in spinach"],
      },
    ];
  }
}

export const recipeService = new RecipeService();
