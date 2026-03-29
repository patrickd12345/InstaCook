import type { CanonicalRecipe } from "@/lib/recipe-schema";

const BASE_URL = "https://www.instacart.com/store/search?q=";

export function buildInstacartSearchUrl(query: string): string {
  return `${BASE_URL}${encodeURIComponent(query)}`;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

const quantityPattern =
  /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*/;

const unitPattern =
  /^(tsp|tsps|teaspoon|teaspoons|tbsp|tbsps|tablespoon|tablespoons|cup|cups|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|kilogram|kilograms|ml|milliliter|milliliters|l|liter|liters|clove|cloves|can|cans|bag|bags|package|packages|bunch|bunches|stick|sticks|piece|pieces)\b\s*/;

const ofPattern = /^of\b\s*/;
const leadingPunctPattern = /^[,.;:()\-\s]+/;

function stripPrefix(
  text: string,
  lower: string,
  pattern: RegExp,
): { text: string; lower: string } {
  const match = lower.match(pattern);
  if (!match) return { text, lower };
  const len = match[0].length;
  return { text: text.slice(len), lower: lower.slice(len) };
}

export function normalizeIngredientForShopping(input: string): string | null {
  let text = input.trim();
  if (text.length === 0) return null;

  let lower = text.toLowerCase();
  ({ text, lower } = stripPrefix(text, lower, quantityPattern));
  ({ text, lower } = stripPrefix(text, lower, unitPattern));
  ({ text, lower } = stripPrefix(text, lower, ofPattern));
  ({ text, lower } = stripPrefix(text, lower, leadingPunctPattern));
  text = text.trim();

  if (text.length === 0) return null;
  return text;
}

export function buildInstacartLinks(
  recipe: CanonicalRecipe,
): { item: string; url: string }[] {
  return collectInstacartQueries(recipe).map((query) => ({
    item: query,
    url: buildInstacartSearchUrl(query),
  }));
}

export function buildInstacartBulkSearchUrl(
  recipe: CanonicalRecipe,
): string | null {
  const queries = collectInstacartQueries(recipe, 10);
  if (queries.length === 0) return null;
  return buildInstacartSearchUrl(queries.join(", "));
}

function collectInstacartQueries(
  recipe: CanonicalRecipe,
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const ingredient of recipe.ingredients) {
    if (queries.length >= limit) break;
    const itemText = ingredient.item?.trim() ?? "";
    const rawText = ingredient.raw?.trim() ?? "";
    const source = itemText.length > 0 ? itemText : rawText;
    if (source.length === 0) continue;

    const normalizedIngredient = normalizeIngredientForShopping(source);
    const query = normalizedIngredient ?? source;
    const normalizedKey = normalizeQuery(query);
    if (seen.has(normalizedKey)) continue;

    seen.add(normalizedKey);
    queries.push(query);
  }

  return queries;
}
