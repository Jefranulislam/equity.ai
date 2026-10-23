import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Freya's AI provider factory.
 *
 * Two deployment modes (see HowToSetup.md, "Freya AI configuration"):
 *  - Lovable AI Gateway (default): set `LOVABLE_API_KEY` only.
 *  - Any OpenAI-compatible endpoint: set `AI_API_KEY`, and optionally
 *    `AI_BASE_URL` (e.g. https://api.openai.com/v1 or a self-hosted vLLM)
 *    plus `AI_MODEL` (e.g. google/gemini-2.5-flash or gpt-4o-mini), which
 *    chat.ts passes through to the returned provider.
 */
export const createLovableAiGatewayProvider = (lovableApiKey: string) =>
  createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

export const createCustomAiProvider = (apiKey: string, baseUrl?: string) =>
  createOpenAICompatible({
    name: "custom",
    baseURL: baseUrl ?? "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: {
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
