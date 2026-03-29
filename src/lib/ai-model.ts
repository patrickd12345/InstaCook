import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Resolves a chat model for recipe search assistance.
 * Priority: Ollama (local) → Vercel AI Gateway → OpenAI direct.
 * Set only the credentials you use; omit the rest.
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
    const id = process.env.OLLAMA_MODEL?.trim() ?? "llama3.2";
    return openai(id);
  }

  const gatewayKey = process.env.VERCEL_AI_GATEWAY_API_KEY?.trim();
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
