import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { searchRecipesWithWebAndAi } from "@/lib/recipe-search";
import { recipeQuerySchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query } = recipeQuerySchema.parse(body);
    const result = await searchRecipesWithWebAndAi(query);

    const hasAny =
      result.local.length > 0 ||
      result.web.length > 0 ||
      result.recipes.length > 0;

    if (!hasAny) {
      return NextResponse.json(
        {
          ...result,
          detail:
            "No recipes matched in the catalog, on the web, or via normalization. Try different keywords or configure web search (GOOGLE_CSE_*).",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ detail: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }
}
