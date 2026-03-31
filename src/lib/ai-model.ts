import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Resolves a chat model for recipe search assistance.
 * Priority: Ollama (local) → Vercel AI Gateway → OpenAI direct.
 * Set `OLLAMA_BASE_URL` in `.env.local` for free local inference; omit it on
 * Vercel (or anywhere without Ollama) so `VERCEL_AI_GATEWAY_API_KEY` / `VERCEL_VIRTUAL_KEY` is used.
 */
export function getRecipeSearchModel(): LanguageModel | null {
  const ollamaBase = process.env.OLLAMA_BASE_URL?.trim();
  if (ollamaBase) {
    const baseURL = ollamaBase.includes("/v1")
      ? ollamaBase
      : `${ollamaBase.replace(/\/$/, "")}/v1`;
    const openai = createOpenAI({
      baseURL,
      apiKey: process.env.OLLAMA_API_KEY?.trim() ?? "ollama",
    });
    /** Ollama expects a tag (e.g. `mistral:latest`). Run `ollama pull mistral` if missing. */
    const id = process.env.OLLAMA_MODEL?.trim() ?? "mistral:latest";
    return openai(id);
  }

  const gatewayKey =
    process.env.VERCEL_AI_GATEWAY_API_KEY?.trim() ??
    process.env.VERCEL_VIRTUAL_KEY?.trim();
  if (gatewayKey) {
    const openai = createOpenAI({
      baseURL:
        process.env.AI_GATEWAY_BASE_URL?.trim() ??
        "https://ai-gateway.vercel.sh/v1",
      apiKey: gatewayKey,
    });
    const id =
      process.env.AI_GATEWAY_MODEL?.trim() ?? "openai/gpt-4o-mini";
    return openai(id);
  }

  const direct = process.env.OPENAI_API_KEY?.trim();
  if (direct) {
    const openai = createOpenAI({ apiKey: direct });
    const id = process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini";
    return openai(id);
  }

  return null;
}
