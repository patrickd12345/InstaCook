import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPublisherSearchQuery,
  DEFAULT_RECIPE_SEARCH_SITES,
  isTrustedRecipeUrl,
  normalizeRecipeHost,
  parseBingRssItems,
  searchPublisherRecipes,
} from "@/lib/recipe-web-search";

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.restoreAllMocks();
});

describe("buildPublisherSearchQuery", () => {
  it("combines user query with site filters", () => {
    const q = buildPublisherSearchQuery("chicken curry", [
      "bonappetit.com",
      "ricardocuisine.com",
    ]);
    expect(q).toContain("chicken curry");
    expect(q).toContain("site:bonappetit.com");
    expect(q).toContain("site:ricardocuisine.com");
    expect(q).toContain(" OR ");
  });

  it("uses default publisher list", () => {
    const q = buildPublisherSearchQuery("pasta");
    for (const site of DEFAULT_RECIPE_SEARCH_SITES) {
      expect(q).toContain(`site:${site}`);
    }
  });
});

describe("normalizeRecipeHost", () => {
  it("strips www prefix", () => {
    expect(normalizeRecipeHost("WWW.BonAppetit.COM")).toBe("bonappetit.com");
  });
});

describe("isTrustedRecipeUrl", () => {
  it("allows https on allowlisted host", () => {
    expect(isTrustedRecipeUrl("https://www.bonappetit.com/recipe/foo")).toBe(true);
    expect(isTrustedRecipeUrl("https://bonappetit.com/recipe/foo")).toBe(true);
  });

  it("rejects non-https", () => {
    expect(isTrustedRecipeUrl("http://bonappetit.com/r")).toBe(false);
  });

  it("rejects untrusted host", () => {
    expect(isTrustedRecipeUrl("https://evil.com/recipe")).toBe(false);
  });

  it("rejects malformed URL", () => {
    expect(isTrustedRecipeUrl("not a url")).toBe(false);
  });
});

describe("parseBingRssItems", () => {
  it("extracts title, link, and description from rss items", () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Spaghetti &amp; Meatballs</title>
          <link>https://www.foodnetwork.com/recipes/x</link>
          <description>Classic pasta dinner</description>
        </item>
      </channel></rss>
    `;

    expect(parseBingRssItems(xml)).toEqual([
      {
        title: "Spaghetti & Meatballs",
        link: "https://www.foodnetwork.com/recipes/x",
        snippet: "Classic pasta dinner",
      },
    ]);
  });
});

describe("searchPublisherRecipes fallback", () => {
  it("uses Bing RSS fallback when Google CSE is not configured", async () => {
    delete process.env.GOOGLE_CSE_API_KEY;
    delete process.env.GOOGLE_CSE_ID;
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          `
            <rss><channel>
              <item>
                <title>28 Best Spaghetti Recipes &amp; Ideas | Food Network</title>
                <link>https://www.foodnetwork.com/recipes/photos/spaghetti-recipes</link>
                <description>Guaranteed crowd-pleasers.</description>
              </item>
              <item>
                <title>Ignore me</title>
                <link>https://example.com/not-trusted</link>
                <description>Nope</description>
              </item>
            </channel></rss>
          `,
          { status: 200, headers: { "Content-Type": "application/xml" } },
        ) as unknown as Response,
      ),
    );

    const result = await searchPublisherRecipes("spaghetti");

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.url).toBe(
      "https://www.foodnetwork.com/recipes/photos/spaghetti-recipes",
    );
    expect(result.warning).toContain("built-in fallback");
  });

  it("falls back to site-specific Bing queries when broad search has no trusted hits", async () => {
    delete process.env.GOOGLE_CSE_API_KEY;
    delete process.env.GOOGLE_CSE_ID;
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          `
            <rss><channel>
              <item>
                <title>Untrusted result</title>
                <link>https://example.com/nope</link>
                <description>Nope</description>
              </item>
            </channel></rss>
          `,
          { status: 200 },
        ) as unknown as Response,
      )
      .mockResolvedValueOnce(
        new Response(
          `
            <rss><channel>
              <item>
                <title>Spaghetti Recipe</title>
                <link>https://www.bonappetit.com/recipe/best-spaghetti-and-meatballs</link>
                <description>Trusted hit</description>
              </item>
            </channel></rss>
          `,
          { status: 200 },
        ) as unknown as Response,
      )
      .mockImplementation(() =>
        Promise.resolve(
          new Response(`<rss><channel></channel></rss>`, {
            status: 200,
          }) as unknown as Response,
        ),
      );

    const result = await searchPublisherRecipes("spaghetti");

    expect(fetchMock).toHaveBeenCalled();
    expect(result.hits[0]?.displayLink).toContain("bonappetit.com");
    expect(result.warning).toContain("built-in fallback");
  });

  it("keeps broad hits and adds more site-specific hits up to the limit", async () => {
    delete process.env.GOOGLE_CSE_API_KEY;
    delete process.env.GOOGLE_CSE_ID;
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          `
            <rss><channel>
              <item>
                <title>Food Network Spaghetti</title>
                <link>https://www.foodnetwork.com/recipes/photos/spaghetti-recipes</link>
                <description>FN hit</description>
              </item>
            </channel></rss>
          `,
          { status: 200 },
        ) as unknown as Response,
      )
      .mockResolvedValueOnce(
        new Response(
          `
            <rss><channel>
              <item>
                <title>Bon Appetit Spaghetti</title>
                <link>https://www.bonappetit.com/recipe/best-spaghetti-and-meatballs</link>
                <description>BA hit</description>
              </item>
            </channel></rss>
          `,
          { status: 200 },
        ) as unknown as Response,
      )
      .mockResolvedValueOnce(
        new Response(
          `
            <rss><channel>
              <item>
                <title>Ricardo Spaghetti</title>
                <link>https://www.ricardocuisine.com/en/recipes/1234-spaghetti</link>
                <description>RC hit</description>
              </item>
            </channel></rss>
          `,
          { status: 200 },
        ) as unknown as Response,
      )
      .mockImplementation(() =>
        Promise.resolve(
          new Response(`<rss><channel></channel></rss>`, {
            status: 200,
          }) as unknown as Response,
        ),
      );

    const result = await searchPublisherRecipes("spaghetti");

    expect(result.hits.map((hit) => hit.url)).toEqual([
      "https://www.foodnetwork.com/recipes/photos/spaghetti-recipes",
      "https://www.bonappetit.com/recipe/best-spaghetti-and-meatballs",
      "https://www.ricardocuisine.com/en/recipes/1234-spaghetti",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
