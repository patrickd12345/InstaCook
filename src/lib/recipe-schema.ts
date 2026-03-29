import { z } from "zod";

export const canonicalMealTypeSchema = z.enum([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
]);

export const canonicalIngredientSchema = z.object({
  raw: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  item: z.string(),
  notes: z.string().nullable(),
});

export const canonicalStepSchema = z.object({
  order: z.number().int().min(1),
  text: z.string(),
});

export const canonicalRecipeSchema = z.object({
  title: z.string().min(1),
  source_url: z.string().url(),
  source_name: z.string().min(1),
  description: z.string().nullable(),
  servings: z.number().nullable(),
  prep_time_minutes: z.number().nullable(),
  cook_time_minutes: z.number().nullable(),
  total_time_minutes: z.number().nullable(),
  ingredients: z.array(canonicalIngredientSchema),
  steps: z.array(canonicalStepSchema),
  tags: z.array(z.string()),
  meal_type: canonicalMealTypeSchema.nullable(),
  cuisine: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  extraction_warnings: z.array(z.string()),
});

export type CanonicalRecipe = z.infer<typeof canonicalRecipeSchema>;

/** Fields produced by the model; `source_url` and `source_name` are merged server-side. */
export const canonicalRecipeModelOutputSchema = canonicalRecipeSchema.omit({
  source_url: true,
  source_name: true,
});

export type CanonicalRecipeModelOutput = z.infer<
  typeof canonicalRecipeModelOutputSchema
>;

/** True if the recipe has enough content to show after normalization. */
export function isSubstantialCanonicalRecipe(r: CanonicalRecipe): boolean {
  if (r.title.trim().length === 0) return false;
  if (r.ingredients.length === 0 && r.steps.length === 0) return false;
  return true;
}
