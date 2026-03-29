import { describe, expect, it } from "vitest";

import { fetchTrustedRecipePage } from "@/lib/recipe-page-fetch";

describe("fetchTrustedRecipePage", () => {
  it("returns error for untrusted domain without fetching", async () => {
    const r = await fetchTrustedRecipePage("https://evil.com/page");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("trusted");
    }
  });
});
