import { generateObject } from "ai";

import { getRecipeSearchModel } from "@/lib/ai-model";

const DEFAULT_AI_TIMEOUT_MS = 30_000;

function getRecipeAiTimeoutMs(): number {
  const raw = process.env.RECIPE_AI_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_AI_TIMEOUT_MS;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_AI_TIMEOUT_MS;
  return Math.min(n, 300_000);
}

function recipeAiAbortSignal(): AbortSignal {
  return AbortSignal.timeout(getRecipeAiTimeoutMs());
}

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (e instanceof Error) {
    if (e.name === "AbortError" || e.name === "TimeoutError") return true;
    if ("code" in e && (e as NodeJS.ErrnoException).code === "ABORT_ERR")
      return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /aborted|abort|timeout/i.test(msg);
}
import type { ExtractedRecipePagePayload } from "@/lib/recipe-page-extract";
import type { WebRecipeHit } from "@/lib/recipe-web-search";
import {
  canonicalRecipeModelOutputSchema,
  canonicalRecipeSchema,
  type CanonicalRecipe,
  type CanonicalRecipeModelOutput,
} from "@/lib/recipe-schema";

export type NormalizePageResult = {
  recipe: CanonicalRecipe | null;
  warnings: string[];
};

/** Merge server-enforced source fields and validate (for tests and post-AI checks). */
export function mergeAndValidateCanonicalRecipe(
  modelOutput: CanonicalRecipeModelOutput,
  sourceUrl: string,
  sourceName: string,
): ReturnType<typeof canonicalRecipeSchema.safeParse> {
  return canonicalRecipeSchema.safeParse({
    ...modelOutput,
    source_url: sourceUrl,
    source_name: sourceName,
  });
}

function buildNormalizePrompt(
  extracted: ExtractedRecipePagePayload,
  userQuery: string,
): string {
  return `You normalize recipe content into strict JSON. Rules:
- Use ONLY information present in the page excerpt below. Do not invent ingredients, steps, times, or servings.
- If a value is not clearly stated in the text, use null (not guesses).
- For ingredients: "item" is the food name; "raw" is the line as you would read it on the page; parse amount/unit when explicitly given, else null.
- For steps: "order" starts at 1 in cooking order; "text" must come from instruction text on the page (you may lightly fix typos).
- "tags": only topical tags supported by the page (e.g. vegetarian), else [].
- "meal_type" and "cuisine": null unless clearly implied.
- "confidence": number from 0 to 1, conservative (lower if excerpt is fragmented or recipe is incomplete).
- "extraction_warnings": include short reasons for missing data, ambiguity, or truncated excerpt.
- Do NOT include source_url or source_name in your answer; they are set by the server.

User search query (context only): ${JSON.stringify(userQuery)}

--- Page title: ${JSON.stringify(extracted.pageTitle)}
--- Meta description: ${JSON.stringify(extracted.metaDescription)}
--- URL (reference only, do not output): ${extracted.pageUrl}

--- Main text excerpt ---
${extracted.contentExcerpt}`;
}

function buildSearchHitPrompt(hit: WebRecipeHit, userQuery: string): string {
  return `You are generating a recipe card to answer a user's search.
Use your general cooking knowledge AND the web search snippet below.

Rules:
- Provide a best-effort complete recipe even if the snippet is sparse.
- If uncertain, choose common, reasonable defaults for ingredients and steps.
- Mark uncertainty via "confidence" (0 to 1). Use a low value if guessing.
- "raw" should be a readable ingredient line; "item" is the core food name.
- "steps" must be practical cooking steps; keep them concise.
- "extraction_warnings" must mention when details are inferred or guessed.
- Do NOT include source_url or source_name in your answer; they are set by the server.

User search query: ${JSON.stringify(userQuery)}
Search result title: ${JSON.stringify(hit.title)}
Search result snippet: ${JSON.stringify(hit.snippet)}
Search result URL (reference only): ${hit.url}`;
}

export async function normalizeExtractedPage(args: {
  extracted: ExtractedRecipePagePayload;
  userQuery: string;
  sourceUrl: string;
  sourceName: string;
}): Promise<NormalizePageResult> {
  const warnings: string[] = [];
  const model = getRecipeSearchModel();
  if (!model) {
    warnings.push("AI normalization skipped: no model configured.");
    return { recipe: null, warnings };
  }

  let parsed: ReturnType<typeof canonicalRecipeSchema.safeParse>;
  try {
    const { object } = await generateObject({
      model,
      schema: canonicalRecipeModelOutputSchema,
      prompt: buildNormalizePrompt(args.extracted, args.userQuery),
      abortSignal: recipeAiAbortSignal(),
      maxRetries: 0,
    });

    parsed = mergeAndValidateCanonicalRecipe(
      object,
      args.sourceUrl,
      args.sourceName,
    );
  } catch (e) {
    if (isAbortError(e)) {
      warnings.push(
        `AI normalization timed out after ${getRecipeAiTimeoutMs()}ms (set RECIPE_AI_TIMEOUT_MS or check Ollama is responding).`,
      );
      return { recipe: null, warnings };
    }
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`AI normalization failed: ${msg.slice(0, 240)}`);
    return { recipe: null, warnings };
  }

  if (!parsed.success) {
    const issues = parsed.error.flatten();
    warnings.push(
      `Normalized recipe failed validation: ${JSON.stringify(issues.fieldErrors).slice(0, 300)}`,
    );
    return { recipe: null, warnings };
  }

  return { recipe: parsed.data, warnings };
}

export async function normalizeSearchHit(args: {
  hit: WebRecipeHit;
  userQuery: string;
}): Promise<NormalizePageResult> {
  const warnings: string[] = [];
  const model = getRecipeSearchModel();
  if (!model) {
    warnings.push("AI normalization skipped: no model configured.");
    return { recipe: null, warnings };
  }

  let parsed: ReturnType<typeof canonicalRecipeSchema.safeParse>;
  try {
    const { object } = await generateObject({
      model,
      schema: canonicalRecipeModelOutputSchema,
      prompt: buildSearchHitPrompt(args.hit, args.userQuery),
      abortSignal: recipeAiAbortSignal(),
      maxRetries: 0,
    });

    parsed = mergeAndValidateCanonicalRecipe(
      object,
      args.hit.url,
      args.hit.displayLink || new URL(args.hit.url).hostname,
    );
  } catch (e) {
    if (isAbortError(e)) {
      warnings.push(
        `AI normalization timed out after ${getRecipeAiTimeoutMs()}ms (set RECIPE_AI_TIMEOUT_MS or check Ollama is responding).`,
      );
      return { recipe: null, warnings };
    }
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`AI normalization failed: ${msg.slice(0, 240)}`);
    return { recipe: null, warnings };
  }

  if (!parsed.success) {
    const issues = parsed.error.flatten();
    warnings.push(
      `Normalized recipe failed validation: ${JSON.stringify(issues.fieldErrors).slice(0, 300)}`,
    );
    return { recipe: null, warnings };
  }

  return { recipe: parsed.data, warnings };
}
