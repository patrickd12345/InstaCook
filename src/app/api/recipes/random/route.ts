import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { recipeService } from "@/lib/recipe-service";
import { mealTypeSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const mealTypeRaw = new URL(req.url).searchParams.get("meal_type");
  let mealType: ReturnType<typeof mealTypeSchema.parse> | undefined;
  if (mealTypeRaw != null && mealTypeRaw !== "") {
    try {
      mealType = mealTypeSchema.parse(mealTypeRaw);
    } catch (e) {
      if (e instanceof ZodError) {
        return NextResponse.json({ detail: "Invalid meal_type" }, { status: 400 });
      }
      throw e;
    }
  }
  return NextResponse.json(recipeService.randomRecipe(mealType ?? null));
}
