import {
  BARGAIN_SYSTEM_PROMPT,
  ProviderError,
  grokChat,
  type ChatMessage,
  type ProviderResult,
} from "./grok";

export { BARGAIN_SYSTEM_PROMPT, ProviderError };
export type { ChatMessage, ProviderResult };

export type AIProviderId = "gemini";

export type AIProviderStatus = {
  llm: AIProviderId[];
  configured: boolean;
  firecrawl: false;
};

/**
 * MAXWEB's provider registry follows Skilldrem's central provider boundary,
 * but intentionally registers Gemini only. Credentials are read exclusively
 * by the server-side Gemini adapter in ./grok.
 */
export function getAIProvider(preferred: AIProviderId = "gemini"): AIProviderId | null {
  if (preferred !== "gemini") return null;
  return process.env.MAXWEB_AI_API_KEY2?.trim() ? "gemini" : null;
}

export function listConfiguredProviders(): AIProviderStatus {
  const configured = getAIProvider() !== null;
  return {
    llm: configured ? ["gemini"] : [],
    configured,
    firecrawl: false,
  };
}

/**
 * Single-provider completion boundary. This deliberately does not silently
 * switch to Groq, GLM, or another provider: MAXWEB is configured for Gemini
 * only. Transient Gemini retries are handled by the Gemini adapter.
 */
export async function completeAI(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
): Promise<ProviderResult> {
  if (!getAIProvider()) {
    throw new ProviderError(
      "ai_not_configured",
      "MAXWEB AI is not configured. Add MAXWEB_AI_API_KEY2 to the Vercel server environment.",
      { provider: "none", retryable: false }
    );
  }

  return grokChat(messages, options);
}
