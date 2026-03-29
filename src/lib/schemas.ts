import { z } from "zod";

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner"]);
export type MealType = z.infer<typeof mealTypeSchema>;

export const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
});

export const recipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  servings: z.number().int().positive(),
  meal_type: mealTypeSchema,
  ingredients: z.array(ingredientSchema),
  steps: z.array(z.string()),
});

export type Recipe = z.infer<typeof recipeSchema>;

export const recipeQuerySchema = z.object({
  query: z.string().min(2),
});

export const menuPlanRequestSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(31),
  meals_per_day: z.array(mealTypeSchema).min(1).default(["dinner"]),
});

export const ingredientSummaryItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
});

export const instacartExportRequestSchema = z.object({
  items: z.array(ingredientSummaryItemSchema),
});

export const recipesArraySchema = z.array(recipeSchema);
