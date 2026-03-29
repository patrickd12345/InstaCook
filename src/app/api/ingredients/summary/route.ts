import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { recipeService } from "@/lib/recipe-service";
import { recipesArraySchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const recipes = recipesArraySchema.parse(body);
    return NextResponse.json(recipeService.summarizeIngredients(recipes));
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ detail: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }
}
