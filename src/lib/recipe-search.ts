import { getRecipeSearchModel } from "@/lib/ai-model";
import { normalizeExtractedPage } from "@/lib/recipe-normalize";
import { extractRecipePageContent } from "@/lib/recipe-page-extract";
import { fetchTrustedRecipePage } from "@/lib/recipe-page-fetch";
import { recipeService } from "@/lib/recipe-service";
import {
  isSubstantialCanonicalRecipe,
  type CanonicalRecipe,
} from "@/lib/recipe-schema";
import {
  isTrustedRecipeUrl,
  searchPublisherRecipes,
  type WebRecipeHit,
} from "@/lib/recipe-web-search";
import type { Recipe } from "@/lib/schemas";

const DEFAULT_MAX_PAGES = 4;

function maxNormalizePages(): number {
  const raw = process.env.RECIPE_NORMALIZE_MAX_PAGES?.trim();
  if (!raw) return DEFAULT_MAX_PAGES;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_PAGES;
  return Math.min(n, 5);
}

export type RecipeSearchResponse = {
  query: string;
  local: Recipe[];
  web: WebRecipeHit[];
  recipes: CanonicalRecipe[];
  warnings: string[];
};

export async function searchRecipesWithWebAndAi(
  query: string,
): Promise<RecipeSearchResponse> {
  const local = recipeService.findRecipe(query);
  const { hits: web, warning: webWarning } = await searchPublisherRecipes(query);

  const warnings: string[] = [];
  if (webWarning) warnings.push(webWarning);

  const candidates = web
    .filter((h) => isTrustedRecipeUrl(h.url))
    .slice(0, maxNormalizePages());

  const recipes: CanonicalRecipe[] = [];
  const seenUrls = new Set<string>();

  const model = getRecipeSearchModel();
  if (!model && candidates.length > 0) {
    warnings.push(
      "AI normalization disabled. Set OLLAMA_BASE_URL, VERCEL_AI_GATEWAY_API_KEY, or OPENAI_API_KEY to build structured recipes from web pages.",
    );
  }

  for (const hit of candidates) {
    if (seenUrls.has(hit.url)) continue;

    const fetched = await fetchTrustedRecipePage(hit.url);
    if (!fetched.ok) {
      warnings.push(`Fetch ${hit.url}: ${fetched.error}`);
      continue;
    }

    const extracted = extractRecipePageContent(fetched.html, fetched.url);
    const { recipe, warnings: nw } = await normalizeExtractedPage({
      extracted,
      userQuery: query,
      sourceUrl: hit.url,
      sourceName: hit.displayLink || new URL(hit.url).hostname,
    });

    for (const w of nw) warnings.push(w);

    if (recipe && isSubstantialCanonicalRecipe(recipe)) {
      if (!seenUrls.has(recipe.source_url)) {
        seenUrls.add(recipe.source_url);
        recipes.push(recipe);
      }
    } else if (recipe && !isSubstantialCanonicalRecipe(recipe)) {
      warnings.push(
        `Discarded sparse extraction for ${hit.url} (needs ingredients or steps).`,
      );
    }
  }

  return {
    query,
    local,
    web,
    recipes,
    warnings,
  };
}
