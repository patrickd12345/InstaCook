import { generateObject } from "ai";

import { getRecipeSearchModel } from "@/lib/ai-model";
import type { ExtractedRecipePagePayload } from "@/lib/recipe-page-extract";
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
    });

    parsed = mergeAndValidateCanonicalRecipe(
      object,
      args.sourceUrl,
      args.sourceName,
    );
  } catch (e) {
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
