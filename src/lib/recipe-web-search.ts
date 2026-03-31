/** Default publisher domains for recipe web search (Google Programmable Search). */
export const DEFAULT_RECIPE_SEARCH_SITES = [
  "bonappetit.com",
  "ricardocuisine.com",
  "seriouseats.com",
  "foodnetwork.com",
] as const;

export type WebRecipeHit = {
  title: string;
  url: string;
  snippet: string;
  displayLink: string;
};

type SearchResult = { hits: WebRecipeHit[]; warning?: string };

function parseSitesEnv(): string[] | null {
  const raw = process.env.RECIPE_SEARCH_SITES?.trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Lowercase hostname without leading "www." */
export function normalizeRecipeHost(hostname: string): string {
  const h = hostname.trim().toLowerCase();
  return h.startsWith("www.") ? h.slice(4) : h;
}

/** Hostnames trusted for recipe page fetch (same list as CSE site filter). */
export function getTrustedRecipeHosts(): string[] {
  return parseSitesEnv() ?? [...DEFAULT_RECIPE_SEARCH_SITES];
}

export function getTrustedRecipeHostSet(): Set<string> {
  return new Set(getTrustedRecipeHosts().map(normalizeRecipeHost));
}

export function isTrustedRecipeUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = normalizeRecipeHost(url.hostname);
  return getTrustedRecipeHostSet().has(host);
}

export function buildPublisherSearchQuery(
  userQuery: string,
  sites: readonly string[] = DEFAULT_RECIPE_SEARCH_SITES,
): string {
  const siteClause = sites.map((s) => `site:${s}`).join(" OR ");
  return `${userQuery.trim()} (${siteClause})`;
}

type GoogleCseItem = {
  title?: string;
  link?: string;
  snippet?: string;
  displayLink?: string;
};

type BingRssItem = {
  title: string;
  link: string;
  snippet: string;
};

/**
 * Search the web via Google Custom Search JSON API (configure CSE to search the whole web;
 * we restrict with site: in the query).
 */
export async function searchPublisherRecipes(
  query: string,
): Promise<SearchResult> {
  const key = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_ID?.trim();
  if (!key || !cx) {
    return searchPublisherRecipesWithBingFallback(query);
  }

  const sites = parseSitesEnv() ?? [...DEFAULT_RECIPE_SEARCH_SITES];
  const q = buildPublisherSearchQuery(query, sites);
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", q);
  url.searchParams.set("num", "10");

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch {
    return { hits: [], warning: "Web search request failed (network error)." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      hits: [],
      warning: `Web search failed (${res.status}). ${text.slice(0, 200)}`,
    };
  }

  const data = (await res.json()) as {
    items?: GoogleCseItem[];
    error?: { message?: string };
  };

  if (data.error?.message) {
    return { hits: [], warning: data.error.message };
  }

  const items = data.items ?? [];
  const hits: WebRecipeHit[] = items
    .filter((i) => i.link && i.title)
    .map((i) => ({
      title: i.title!,
      url: i.link!,
      snippet: i.snippet ?? "",
      displayLink: i.displayLink ?? new URL(i.link!).hostname,
    }));

  return { hits };
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractXmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

export function parseBingRssItems(xml: string): BingRssItem[] {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return itemBlocks
    .map((block) => ({
      title: decodeXmlEntities(extractXmlTag(block, "title")),
      link: decodeXmlEntities(extractXmlTag(block, "link")),
      snippet: decodeXmlEntities(extractXmlTag(block, "description")),
    }))
    .filter((item) => item.title && item.link);
}

function mapBingRssItem(item: BingRssItem): WebRecipeHit {
  let displayLink = "";
  try {
    displayLink = new URL(item.link).hostname;
  } catch {
    displayLink = "";
  }
  return {
    title: item.title,
    url: item.link,
    snippet: item.snippet,
    displayLink,
  };
}

async function fetchBingRss(query: string): Promise<SearchResult> {
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("format", "rss");
  url.searchParams.set("q", query);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 InstaCook/1.0" },
    });
  } catch {
    return { hits: [], warning: "Web search request failed (network error)." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      hits: [],
      warning: `Web search failed (${res.status}). ${text.slice(0, 200)}`,
    };
  }

  const xml = await res.text();
  const hits = parseBingRssItems(xml)
    .map(mapBingRssItem)
    .filter((hit) => isTrustedRecipeUrl(hit.url));

  return { hits };
}

async function searchPublisherRecipesWithBingFallback(
  query: string,
): Promise<SearchResult> {
  const warning =
    "Web search is using the built-in fallback because GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID are not set.";
  const broad = await fetchBingRss(`${query.trim()} recipe`);
  const trustedHosts = getTrustedRecipeHosts();
  const seen = new Set<string>();
  const hits: WebRecipeHit[] = [];

  for (const hit of broad.hits) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    hits.push(hit);
  }

  for (const host of trustedHosts) {
    if (hits.length >= 10) break;
    const result = await fetchBingRss(`${query.trim()} recipe site:${host}`);
    for (const hit of result.hits) {
      if (seen.has(hit.url)) continue;
      seen.add(hit.url);
      hits.push(hit);
      if (hits.length >= 10) break;
    }
  }

  if (hits.length > 0) {
    return {
      hits: hits.slice(0, 10),
      warning,
    };
  }

  return {
    hits: [],
    warning:
      broad.warning ??
      "Web search fallback found no trusted recipe results. Configure GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID for better coverage.",
  };
}
