"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildInstacartBulkSearchUrl,
  buildInstacartLinks,
} from "@/lib/instacart";
import type { CanonicalRecipe } from "@/lib/recipe-schema";
import type { MealType, Recipe } from "@/lib/schemas";

type MenuPlanResponse = {
  start_date: string;
  days: number;
  daily_plans: {
    date: string;
    meals: Record<MealType, Recipe>;
  }[];
};

type IngredientSummary = {
  items: { name: string; quantity: number; unit: string }[];
};

type RecipeSearchResponse = {
  query: string;
  local: Recipe[];
  web: {
    title: string;
    url: string;
    snippet: string;
    displayLink: string;
  }[];
  recipes: CanonicalRecipe[];
  warnings: string[];
};

const MEALS: MealType[] = ["breakfast", "lunch", "dinner"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function HomePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("curry");
  const [searchResult, setSearchResult] = useState<RecipeSearchResponse | null>(
    null,
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [randomRecipe, setRandomRecipe] = useState<Recipe | null>(null);
  const [randomMealFilter, setRandomMealFilter] = useState<MealType | "">("");
  const [startDate, setStartDate] = useState(todayIso);
  const [planDays, setPlanDays] = useState(7);
  const [mealsPerDay, setMealsPerDay] = useState<MealType[]>([
    "breakfast",
    "dinner",
  ]);
  const [menuPlan, setMenuPlan] = useState<MenuPlanResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<IngredientSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [instacartUrl, setInstacartUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const selectedRecipes = useMemo(
    () => recipes.filter((r) => selectedIds.has(r.id)),
    [recipes, selectedIds],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/recipes");
        if (!res.ok) throw new Error("Failed to load recipes");
        const data = (await res.json()) as Recipe[];
        if (!cancelled) setRecipes(data);
      } catch {
        if (!cancelled) setLoadError("Could not load recipes.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }, []);

  const toggleMeal = (m: MealType) => {
    setMealsPerDay((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const toggleRecipe = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          InstaCook
        </h1>
        <p className="mt-3 text-lg text-[var(--muted)]">
          Menu plans, combined shopping lists, and Instacart search links.
        </p>
      </header>

      {loadError && (
        <p className="mb-6 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-red-200">
          {loadError}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[var(--surface)]/80 p-6 shadow-xl backdrop-blur-sm">
          <h2 className="text-lg font-medium text-white">Recipes</h2>
          <ul className="mt-4 space-y-3">
            {recipes.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleRecipe(r.id)}
                  className="mt-1 size-4 rounded border-white/20"
                  aria-label={`Select ${r.title}`}
                />
                <div>
                  <p className="font-medium text-white">{r.title}</p>
                  <p className="text-sm text-[var(--muted)]">{r.description}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-sky-300/90">
                    {r.meal_type} · {r.servings} servings
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-8">
          <section className="rounded-2xl border border-white/10 bg-[var(--surface)]/80 p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-medium text-white">Search</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40"
                placeholder="Dish or ingredient (min 2 chars)"
              />
              <button
                type="button"
                disabled={busy === "search"}
                onClick={() =>
                  run("search", async () => {
                    setSearchError(null);
                    setSearchResult(null);
                    const res = await fetch("/api/recipes/search", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ query: searchQuery }),
                    });
                    if (res.status === 404) {
                      const body = (await res.json()) as { detail?: string };
                      setSearchError(
                        body.detail ??
                          "No recipes matched in catalog, web, or normalization.",
                      );
                      return;
                    }
                    if (!res.ok) {
                      setSearchError("Search failed.");
                      return;
                    }
                    setSearchResult((await res.json()) as RecipeSearchResponse);
                  })
                }
                className="rounded-lg bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] px-4 py-2 font-medium text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                {busy === "search" ? "Searching…" : "Search"}
              </button>
            </div>
            {searchError && (
              <p className="mt-2 text-sm text-amber-200">{searchError}</p>
            )}
            {searchResult && (
              <div className="mt-4 space-y-4 text-sm">
                {searchResult.warnings.length > 0 && (
                  <ul className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-amber-100/90">
                    {searchResult.warnings.map((w, i) => (
                      <li key={`${i}-${w.slice(0, 80)}`}>{w}</li>
                    ))}
                  </ul>
                )}
                {searchResult.recipes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                      Normalized from web (AI)
                    </p>
                    <ul className="mt-2 space-y-4">
                      {searchResult.recipes.map((r) => {
                        const instacartLinks = buildInstacartLinks(r);
                        const instacartBulkUrl = buildInstacartBulkSearchUrl(r);
                        return (
                        <li
                          key={r.source_url}
                          className="rounded-lg border border-white/10 bg-black/25 px-3 py-3"
                        >
                          <p className="font-medium text-white">{r.title}</p>
                          <p className="mt-1 text-xs text-white/60">
                            Source:{" "}
                            <a
                              href={r.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-300 underline-offset-2 hover:underline"
                            >
                              {r.source_name}
                            </a>
                            {" · "}
                            Confidence {(r.confidence * 100).toFixed(0)}%
                          </p>
                          {(r.servings != null ||
                            r.prep_time_minutes != null ||
                            r.cook_time_minutes != null ||
                            r.total_time_minutes != null) && (
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {r.servings != null && <span>Serves {r.servings}. </span>}
                              {r.prep_time_minutes != null && (
                                <span>Prep {r.prep_time_minutes} min. </span>
                              )}
                              {r.cook_time_minutes != null && (
                                <span>Cook {r.cook_time_minutes} min. </span>
                              )}
                              {r.total_time_minutes != null && (
                                <span>Total {r.total_time_minutes} min.</span>
                              )}
                            </p>
                          )}
                          {r.description && (
                            <p className="mt-2 text-[var(--muted)]">
                              {r.description}
                            </p>
                          )}
                          {(r.meal_type || r.cuisine || r.tags.length > 0) && (
                            <p className="mt-1 text-xs text-white/50">
                              {[r.meal_type, r.cuisine, ...r.tags]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {r.ingredients.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-white/70">
                                Ingredients (first {Math.min(5, r.ingredients.length)})
                              </p>
                              <ul className="mt-1 list-inside list-disc text-[var(--muted)]">
                                {r.ingredients.slice(0, 5).map((ing, i) => (
                                  <li key={`${ing.raw}-${i}`}>{ing.raw || ing.item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {instacartLinks.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-white/70">
                                Shop on Instacart
                              </p>
                              <ul className="mt-1 space-y-1 text-[var(--muted)]">
                                {instacartLinks.map((link) => (
                                  <li key={link.url}>
                                    <a
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sky-300 underline-offset-2 hover:underline"
                                    >
                                      {link.item}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                              {instacartBulkUrl && (
                                <a
                                  href={instacartBulkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-flex items-center rounded-md border border-sky-400/40 px-2.5 py-1 text-xs font-medium text-sky-200 transition hover:border-sky-300/70 hover:text-sky-100"
                                >
                                  Shop all on Instacart
                                </a>
                              )}
                            </div>
                          )}
                          {r.steps.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-white/70">
                                Steps (first {Math.min(3, r.steps.length)})
                              </p>
                              <ol className="mt-1 list-inside list-decimal text-[var(--muted)]">
                                {r.steps.slice(0, 3).map((s) => (
                                  <li key={s.order}>{s.text}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                          {r.extraction_warnings.length > 0 && (
                            <ul className="mt-2 space-y-0.5 text-xs text-amber-200/90">
                              {r.extraction_warnings.map((w) => (
                                <li key={w}>{w}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {searchResult.local.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                      In-app catalog
                    </p>
                    <ul className="mt-2 space-y-2 text-[var(--muted)]">
                      {searchResult.local.map((r) => (
                        <li key={r.id} className="text-white">
                          {r.title}
                          <span className="text-white/50"> — {r.meal_type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {searchResult.web.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                      Web (raw hits)
                    </p>
                    <ul className="mt-2 space-y-3">
                      {searchResult.web.map((h) => (
                        <li
                          key={h.url}
                          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                        >
                          <a
                            href={h.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sky-300 underline-offset-2 hover:underline"
                          >
                            {h.title}
                          </a>
                          <p className="mt-1 text-xs text-white/50">{h.displayLink}</p>
                          {h.snippet && (
                            <p className="mt-1 text-[var(--muted)]">{h.snippet}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[var(--surface)]/80 p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-medium text-white">Random pick</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={randomMealFilter}
                onChange={(e) =>
                  setRandomMealFilter((e.target.value || "") as MealType | "")
                }
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              >
                <option value="">Any meal</option>
                {MEALS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy === "random"}
                onClick={() =>
                  run("random", async () => {
                    const q =
                      randomMealFilter === ""
                        ? ""
                        : `?meal_type=${randomMealFilter}`;
                    const res = await fetch(`/api/recipes/random${q}`);
                    if (!res.ok) return;
                    setRandomRecipe((await res.json()) as Recipe);
                  })
                }
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {busy === "random" ? "Drawing…" : "Pick random"}
              </button>
            </div>
            {randomRecipe && (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-3">
                <p className="font-medium text-white">{randomRecipe.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  {randomRecipe.description}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[var(--surface)]/80 p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-medium text-white">Menu plan</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-[var(--muted)]">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                />
              </label>
              <label className="block text-sm text-[var(--muted)]">
                Days (1–31)
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={planDays}
                  onChange={(e) => setPlanDays(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                />
              </label>
            </div>
            <fieldset className="mt-4">
              <legend className="text-sm text-[var(--muted)]">Meals per day</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {MEALS.map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-2 text-sm text-white"
                  >
                    <input
                      type="checkbox"
                      checked={mealsPerDay.includes(m)}
                      onChange={() => toggleMeal(m)}
                      className="size-4 rounded border-white/20"
                    />
                    {m}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              disabled={busy === "plan" || mealsPerDay.length === 0}
              onClick={() =>
                run("plan", async () => {
                  setPlanError(null);
                  setMenuPlan(null);
                  const res = await fetch("/api/menu-plans", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      start_date: startDate,
                      days: planDays,
                      meals_per_day: mealsPerDay,
                    }),
                  });
                  if (!res.ok) {
                    setPlanError("Could not build plan.");
                    return;
                  }
                  setMenuPlan((await res.json()) as MenuPlanResponse);
                })
              }
              className="mt-4 w-full rounded-lg bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] px-4 py-2 font-medium text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
            >
              {busy === "plan" ? "Building…" : "Build plan"}
            </button>
            {planError && (
              <p className="mt-2 text-sm text-amber-200">{planError}</p>
            )}
            {menuPlan && (
              <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto text-sm">
                {menuPlan.daily_plans.map((d) => (
                  <li
                    key={d.date}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <p className="font-medium text-white">{d.date}</p>
                    <ul className="mt-1 text-[var(--muted)]">
                      {Object.entries(d.meals).map(([meal, recipe]) => (
                        <li key={meal}>
                          <span className="text-sky-300/90">{meal}</span>:{" "}
                          {recipe.title}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[var(--surface)]/80 p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-medium text-white">Shopping list</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Select recipes on the left, then merge ingredients.
            </p>
            <button
              type="button"
              disabled={busy === "summary" || selectedRecipes.length === 0}
              onClick={() =>
                run("summary", async () => {
                  setSummaryError(null);
                  setInstacartUrl(null);
                  const res = await fetch("/api/ingredients/summary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(selectedRecipes),
                  });
                  if (!res.ok) {
                    setSummaryError("Could not summarize ingredients.");
                    return;
                  }
                  setSummary((await res.json()) as IngredientSummary);
                })
              }
              className="mt-4 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              {busy === "summary" ? "Merging…" : "Merge ingredients"}
            </button>
            {summaryError && (
              <p className="mt-2 text-sm text-amber-200">{summaryError}</p>
            )}
            {summary && summary.items.length > 0 && (
              <div className="mt-4 space-y-3">
                <ul className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white">
                  {summary.items.map((i) => (
                    <li key={`${i.name}-${i.unit}`}>
                      {i.quantity} {i.unit} {i.name}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy === "instacart"}
                  onClick={() =>
                    run("instacart", async () => {
                      const res = await fetch(
                        "/api/integrations/instacart/export",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ items: summary.items }),
                        },
                      );
                      if (!res.ok) return;
                      const data = (await res.json()) as {
                        checkout_url: string;
                        item_count: number;
                      };
                      setInstacartUrl(data.checkout_url);
                      window.open(
                        data.checkout_url,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    })
                  }
                  className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 font-medium text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "instacart" ? "Preparing…" : "Open Instacart search"}
                </button>
                {instacartUrl && (
                  <a
                    href={instacartUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center text-sm font-medium text-sky-300 underline hover:text-sky-200"
                  >
                    Link again if the tab was blocked
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
