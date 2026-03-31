import { isTrustedRecipeUrl } from "@/lib/recipe-web-search";

const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
/** Browser-like UA; many publishers return 403 for obvious bot identifiers. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type RecipePageFetchOk = {
  ok: true;
  url: string;
  html: string;
};

export type RecipePageFetchErr = {
  ok: false;
  url: string;
  error: string;
};

export type RecipePageFetchResult = RecipePageFetchOk | RecipePageFetchErr;

async function readBodyWithLimit(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    return res.text();
  }
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BYTES) {
        reader.cancel().catch(() => {});
        throw new Error(`Response exceeded ${MAX_BYTES} bytes`);
      }
      chunks.push(value);
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return decoder.decode(merged);
}

export async function fetchTrustedRecipePage(
  urlString: string,
): Promise<RecipePageFetchResult> {
  if (!isTrustedRecipeUrl(urlString)) {
    return {
      ok: false,
      url: urlString,
      error: "URL is not a trusted publisher (https only, allowlisted host).",
    };
  }

  let res: Response;
  try {
    res = await fetch(urlString, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "User-Agent": USER_AGENT,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, url: urlString, error: `Fetch failed: ${msg}` };
  }

  if (!res.ok) {
    return {
      ok: false,
      url: urlString,
      error: `HTTP ${res.status}`,
    };
  }

  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("text/html") && !ctype.includes("application/xhtml")) {
    return {
      ok: false,
      url: urlString,
      error: `Unexpected content-type: ${ctype || "unknown"}`,
    };
  }

  let html: string;
  try {
    html = await readBodyWithLimit(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, url: urlString, error: msg };
  }

  return { ok: true, url: urlString, html };
}
