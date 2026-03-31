# InstaCook

InstaCook is a **Next.js 15** app (React 19) with route handlers for:

- Listing and searching recipes (in-app catalog + optional **web search** on major food publishers, with optional **AI normalization** into a structured `recipes[]` payload)
- Random recipe suggestions
- Menu plans for 1–31 days
- Combined ingredient lists across selected recipes
- Instacart search URLs built from those lists

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) for the UI. API routes live under `/api/*`.

## Deploy to Vercel (`instacook.bookiji.com`)

Production is hosted on **Vercel** under team `patrick-duchesneaus-projects`, project **`instacook`**, with the custom domain **[https://instacook.bookiji.com](https://instacook.bookiji.com)**. The GitHub repo is connected for automatic preview and production deployments on push.

### One-time setup (new machine or fresh clone)

1. Install and log in: [Vercel CLI](https://vercel.com/docs/cli), then `vercel login`.
2. From this repo root, link the project (creates local `.vercel/`; it is gitignored):

   ```bash
   vercel link --yes --project instacook --scope patrick-duchesneaus-projects
   ```

3. **Production secrets** — In the [Vercel project → Settings → Environment Variables](https://vercel.com/patrick-duchesneaus-projects/instacook/settings/environment-variables), add the same keys as in [`.env.example`](./.env.example) for **Production** (and Preview if you want search/AI on preview URLs). At minimum for full search + normalization on the live site:

   - `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID` — publisher web search  
   - `VERCEL_AI_GATEWAY_API_KEY` or `VERCEL_VIRTUAL_KEY` — recipe normalization in production (do **not** set `OLLAMA_BASE_URL` on Vercel unless you intentionally use a reachable remote Ollama)  
   - Optional: `OPENAI_API_KEY`, `RECIPE_SEARCH_SITES`, `RECIPE_NORMALIZE_MAX_PAGES`

   Redeploy after changing env vars (Deployments → … → Redeploy, or push a commit).

4. **Custom domain** — `instacook.bookiji.com` is already attached to this project. Because `bookiji.com` uses **Vercel DNS** (`ns1/ns2.vercel-dns.com`), Vercel can manage the subdomain record; if anything shows “Invalid configuration” in the dashboard, open **Domains** for the project and follow the suggested DNS record.

### Commands

```bash
# Production deploy from your machine (CI usually deploys via Git push instead)
vercel deploy --prod --yes --scope patrick-duchesneaus-projects

# Pull env into .env.local (development only; never commit secrets)
vercel env pull .env.local --scope patrick-duchesneaus-projects
```

Smoke check: `GET https://instacook.bookiji.com/api/health`

## Environment variables

Copy [`.env.example`](./.env.example) to `.env.local` and fill in what you need.

| Variable | Purpose |
| -------- | ------- |
| `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID` | [Google Custom Search JSON API](https://developers.google.com/custom-search/v1/overview) — powers web results from publisher sites (restricted via `site:` in the query). |
| `RECIPE_SEARCH_SITES` | Optional comma-separated domains. Defaults include Bon Appétit, Ricardo, Serious Eats, Food Network. |
| `OLLAMA_BASE_URL` | **First choice.** Local Ollama (`…/v1` added automatically if omitted). Keeps normalization free on your machine. |
| `OLLAMA_MODEL` | Optional. Defaults to `mistral:latest` if unset. Use `ollama pull mistral` (or another tag from `ollama list`). |
| `VERCEL_AI_GATEWAY_API_KEY` or `VERCEL_VIRTUAL_KEY` | **Second choice** when Ollama is not configured (e.g. `instacook.bookiji.com`). Omit `OLLAMA_BASE_URL` in production so the gateway is used. |
| `OPENAI_API_KEY` | **Third choice:** direct OpenAI API if neither Ollama nor gateway is set. |
| `RECIPE_NORMALIZE_MAX_PAGES` | Optional. Max trusted web URLs to fetch and normalize per search (default `4`, cap `5`). |
| `RECIPE_AI_TIMEOUT_MS` | Optional. Per–AI-call timeout in ms so Ollama/Mistral cannot hang forever (default `30000`, max `300000`). |

Without Google CSE keys, search still uses the **catalog** plus a **limited Bing RSS fallback** for `web` hits (with a warning). Without any AI keys, structured `recipes[]` from the web are skipped; with Ollama or gateway, normalization runs when fetch + model succeed.

## Troubleshooting

**`Cannot find module '.../node_modules/next/dist/bin/next'`** — `node_modules` is missing or incomplete (often after an interrupted install). Run `pnpm install` again. On Windows, if deleting `node_modules` fails because paths are too long, remove it from Command Prompt with extended paths, for example: `rmdir /s /q "\\?\C:\full\path\to\InstaCook\node_modules"`, then run `pnpm install`.

**“Web search is using the built-in fallback…”** — Add `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_ID` from [Google Programmable Search](https://programmablesearchengine.google.com/) (enable the Custom Search API in Google Cloud). Results are better than the RSS fallback.

**`Fetch … HTTP 403`** — Many publishers block server-side scraping. The app uses browser-like headers and prefers single-recipe URLs over gallery pages (`/photos/…`). Google CSE often returns recipe pages that fetch more reliably than the fallback.

**`AI normalization failed: model '…' not found` (Ollama)** — Install the model, e.g. `ollama pull mistral`, or set `OLLAMA_MODEL` in `.env.local` to a name from `ollama list` (default is `mistral:latest`).

**Search spins forever / no error** — Each `generateObject` call now aborts after `RECIPE_AI_TIMEOUT_MS` (default 30s). The browser search request aborts after 5 minutes. If Ollama is slow, raise the timeout or lower `RECIPE_NORMALIZE_MAX_PAGES`.

## Scripts

- `pnpm dev` — dev server (Turbopack)
- `pnpm build` / `pnpm start` — production
- `pnpm lint` — ESLint
- `pnpm test` — Vitest (service logic)

## API

- `GET /api/health`
- `GET /api/recipes`
- `POST /api/recipes/search` — body `{ "query": "curry" }` (min 2 chars). Returns JSON: `local` (catalog `Recipe[]`), `web` (publisher hits: title, url, snippet, displayLink), `recipes` (canonical structured recipes from trusted pages when AI normalization is enabled), and `warnings` (fetch/normalize/config hints). **404** only if `local`, `web`, and `recipes` are all empty.
- `GET /api/recipes/random?meal_type=dinner` — `meal_type` optional
- `POST /api/menu-plans`
- `POST /api/ingredients/summary` — body: JSON array of full `Recipe` objects
- `POST /api/integrations/instacart/export` — body `{ "items": [ { "name", "quantity", "unit" } ] }`

## Example menu planning request

```json
{
  "start_date": "2026-03-29",
  "days": 10,
  "meals_per_day": ["breakfast", "dinner"]
}
```
