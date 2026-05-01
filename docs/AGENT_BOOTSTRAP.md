<!-- BEGIN:BOOKIJI-UMBRELLA-BOOTSTRAP:BKI-043B -->
# Bookiji Inc Agent Bootstrap (Read First)

Read this file first for every agent prompt in this child project.

1. Before any analysis, planning, coding, testing, or deployment work, read umbrella `agents.md` source at `../../AGENTS.md`.
2. Then read numbered standards from `../../docs/standards/00-index.md`.
3. If local guidance conflicts with umbrella rules, umbrella rules override local assumptions.
4. This product is part of the Bookiji Inc multi-product system; protect cross-product boundaries and do not perform cross-repo or cross-product changes unless explicitly required.
5. Passing local tests is required but is not sufficient proof of production correctness.
6. When relevant, inspect real deployment/config/auth/external-system behavior before claiming completion.
7. For secrets and production-like operations, follow the umbrella-approved secret handling path in `../../docs/standards/02-secrets-and-config.md` and the **Infisical and secrets** section in umbrella `../../AGENTS.md`. **Default for agents is the Infisical CLI** (and product scripts like `pnpm verify:infisical` / `pnpm infisical:list-keys` where defined). Do not assume Infisical MCP is installed in Cursor; use `@infisical/mcp` only when that server is configured and tool descriptors exist under `mcps/`. Never paste secret values into the chat.
8. Do not claim a fix is complete without evidence appropriate to the defect type (tests, runtime checks, logs, integration proof, or deployment validation as applicable).
9. Enforce umbrella Standard 12 operational baseline for product runtime hygiene: required Sentry error capture and PR traceability template, required `/api/health` uptime endpoint, optional analytics scaffold disabled by default unless explicitly configured.
10. For user-facing web UI claims, follow `../../docs/standards/00-index.md` -> `06-testing-and-verification.md`: run or update a Playwright user-evidence crawl with screenshots, traces/videos/logs, and artifact upload when the product has a web surface.
<!-- END:BOOKIJI-UMBRELLA-BOOTSTRAP:BKI-043B -->

## Project-Specific Notes

Add child-project-specific constraints here. They must not conflict with the mandatory bootstrap section above.
