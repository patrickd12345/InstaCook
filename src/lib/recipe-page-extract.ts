import * as cheerio from "cheerio";

const CONTENT_MAX_CHARS = 18_000;

export type ExtractedRecipePagePayload = {
  pageUrl: string;
  pageTitle: string;
  metaDescription: string | null;
  contentExcerpt: string;
};

function collapseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function extractRecipePageContent(
  html: string,
  pageUrl: string,
): ExtractedRecipePagePayload {
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, iframe").remove();

  const pageTitle = collapseSpace($("title").first().text()) || "";
  const metaDesc =
    $('meta[name="description"]').attr("content")?.trim() ?? null;

  const $main = $("main").first();
  const $article = $("article").first();
  const $body = $("body").first();
  const $html = $("html").first();
  const $pick =
    $main.length > 0
      ? $main
      : $article.length > 0
        ? $article
        : $body.length > 0
          ? $body
          : $html.length > 0
            ? $html
            : null;

  let text = $pick ? collapseSpace($pick.text()) : "";
  if (text.length > CONTENT_MAX_CHARS) {
    text = text.slice(0, CONTENT_MAX_CHARS) + "…";
  }

  return {
    pageUrl,
    pageTitle,
    metaDescription: metaDesc ? collapseSpace(metaDesc) : null,
    contentExcerpt: text,
  };
}
