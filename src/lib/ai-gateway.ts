import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Freya's AI provider factory.
 *
 * Two deployment modes (see HowToSetup.md, "Freya AI configuration"):
 *  - User-supplied OpenRouter key: stored per-user (Settings → AI), highest priority.
 *  - Any OpenAI-compatible endpoint: set `AI_API_KEY`, and optionally
 *    `AI_BASE_URL` (e.g. https://openrouter.ai/api/v1 or a self-hosted vLLM)
 *    plus `AI_MODEL` (e.g. google/gemini-2.5-flash or gpt-4o-mini), which
 *    chat.ts passes through to the returned provider.
 */
export const createCustomAiProvider = (apiKey: string, baseUrl?: string) =>
  createOpenAICompatible({
    name: "custom",
    baseURL: baseUrl ?? "https://openrouter.ai/api/v1",
    apiKey,
    headers: {
      "HTTP-Referer": "https://equity.ai",
      "X-Title": "Equity.AI",
    },
  });

/**
 * OpenRouter provider — used when a user stores their personal OpenRouter API
 * key in Settings → AI. OpenRouter exposes an OpenAI-compatible API, so any
 * model id from https://openrouter.ai/models works (e.g. anthropic/claude-3.5-sonnet).
 */
export const createOpenRouterProvider = (apiKey: string) =>
  createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    headers: {
      // Recommended attribution headers from OpenRouter's docs
      "HTTP-Referer": "https://equity.ai",
      "X-Title": "Equity.AI",
    },
  });
