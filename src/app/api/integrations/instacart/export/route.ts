import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { recipeService } from "@/lib/recipe-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json(recipeService.instacartExport(body));
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ detail: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ detail: "Invalid request" }, { status: 400 });
  }
}
