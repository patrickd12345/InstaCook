import { getRecipeSearchModel } from "@/lib/ai-model";
import {
  normalizeExtractedPage,
  normalizeSearchHit,
} from "@/lib/recipe-normalize";
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

/** Prefer single-recipe pages over hubs like `/photos/…` (often 403 for bots, weak HTML). */
function rankRecipePageUrl(urlString: string): number {
  try {
    const path = new URL(urlString).pathname.toLowerCase();
    if (path.includes("/photos/") || path.includes("/gallery")) return 2;
    if (path.includes("/recipe")) return 0;
    return 1;
  } catch {
    return 1;
  }
}

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
  /** Skip paid/remote work when the built-in catalog already satisfies the query. */
  if (local.length > 0) {
    return {
      query,
      local,
      web: [],
      recipes: [],
      warnings: [],
    };
  }

  const { hits: web, warning: webWarning } = await searchPublisherRecipes(query);

  const warnings: string[] = [];
  if (webWarning) warnings.push(webWarning);

  const candidates = web
    .filter((h) => isTrustedRecipeUrl(h.url))
    .sort((a, b) => rankRecipePageUrl(a.url) - rankRecipePageUrl(b.url))
    .slice(0, maxNormalizePages());

  const recipes: CanonicalRecipe[] = [];
  const seenUrls = new Set<string>();
  let sawPublisher403 = false;

  const model = getRecipeSearchModel();
  if (!model && candidates.length > 0) {
    warnings.push(
      "AI normalization disabled. Set OLLAMA_BASE_URL, VERCEL_AI_GATEWAY_API_KEY, VERCEL_VIRTUAL_KEY, or OPENAI_API_KEY to build structured recipes from web pages.",
    );
  }

  for (const hit of candidates) {
    if (seenUrls.has(hit.url)) continue;

    const fetched = await fetchTrustedRecipePage(hit.url);
    if (!fetched.ok) {
      warnings.push(`Fetch ${hit.url}: ${fetched.error}`);
      if (fetched.error.includes("403")) sawPublisher403 = true;
      const fallback = await normalizeSearchHit({
        hit,
        userQuery: query,
      });
      for (const w of fallback.warnings) warnings.push(w);
      const aiFailedHard = fallback.warnings.some((w) => /timed out|model.*not found|ECONNREFUSED/i.test(w));
      if (fallback.recipe && isSubstantialCanonicalRecipe(fallback.recipe)) {
        if (!seenUrls.has(fallback.recipe.source_url)) {
          seenUrls.add(fallback.recipe.source_url);
          recipes.push(fallback.recipe);
        }
      }
      if (aiFailedHard) break;
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
    const aiFailedHard = nw.some((w) => /timed out|model.*not found|ECONNREFUSED/i.test(w));
    if (aiFailedHard) break;

    if (recipe && isSubstantialCanonicalRecipe(recipe)) {
      if (!seenUrls.has(recipe.source_url)) {
        seenUrls.add(recipe.source_url);
        recipes.push(recipe);
      }
    } else if (recipe && !isSubstantialCanonicalRecipe(recipe) && !aiFailedHard) {
      warnings.push(
        `Discarded sparse extraction for ${hit.url} (needs ingredients or steps).`,
      );
      const fallback = await normalizeSearchHit({
        hit,
        userQuery: query,
      });
      for (const w of fallback.warnings) warnings.push(w);
      if (fallback.recipe && isSubstantialCanonicalRecipe(fallback.recipe)) {
        if (!seenUrls.has(fallback.recipe.source_url)) {
          seenUrls.add(fallback.recipe.source_url);
          recipes.push(fallback.recipe);
        }
      }
    } else if (!recipe && !aiFailedHard) {
      const fallback = await normalizeSearchHit({
        hit,
        userQuery: query,
      });
      for (const w of fallback.warnings) warnings.push(w);
      if (fallback.recipe && isSubstantialCanonicalRecipe(fallback.recipe)) {
        if (!seenUrls.has(fallback.recipe.source_url)) {
          seenUrls.add(fallback.recipe.source_url);
          recipes.push(fallback.recipe);
        }
      }
    }
  }

  if (sawPublisher403) {
    warnings.push(
      "Some pages blocked automated fetch (HTTP 403). Add GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID for recipe URLs that fetch more reliably, or rely on snippet-based AI when the model is available.",
    );
  }

  return {
    query,
    local,
    web,
    recipes,
    warnings,
  };
}
