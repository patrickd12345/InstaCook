import { describe, expect, it, vi, beforeEach } from "vitest";

const searchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/recipe-search", () => ({
  searchRecipesWithWebAndAi: searchMock,
}));

import { POST } from "./route";

describe("POST /api/recipes/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when local, web, and recipes are all empty", async () => {
    searchMock.mockResolvedValue({
      query: "ab",
      local: [],
      web: [],
      recipes: [],
      warnings: [],
    });

    const req = new Request("http://localhost/api/recipes/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "ab" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { detail?: string };
    expect(body.detail).toBeDefined();
  });

  it("returns 200 when only recipes has items", async () => {
    searchMock.mockResolvedValue({
      query: "ab",
      local: [],
      web: [],
      recipes: [
        {
          title: "X",
          source_url: "https://bonappetit.com/r",
          source_name: "bonappetit.com",
          description: null,
          servings: null,
          prep_time_minutes: null,
          cook_time_minutes: null,
          total_time_minutes: null,
          ingredients: [{ raw: "a", amount: null, unit: null, item: "a", notes: null }],
          steps: [{ order: 1, text: "b" }],
          tags: [],
          meal_type: null,
          cuisine: null,
          confidence: 0.5,
          extraction_warnings: [],
        },
      ],
      warnings: [],
    });

    const req = new Request("http://localhost/api/recipes/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "ab" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
