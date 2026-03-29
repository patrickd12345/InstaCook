import { NextResponse } from "next/server";

import { recipeService } from "@/lib/recipe-service";

export async function GET() {
  return NextResponse.json(recipeService.listRecipes());
}
