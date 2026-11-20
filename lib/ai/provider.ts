import {
  BARGAIN_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
  ProviderError,
  grokChat,
  type ChatMessage,
  type ProviderResult,
} from "./grok";

export { BARGAIN_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT, ProviderError };
export type { ChatMessage, ProviderResult };

export type AIProviderId = "gemini";

export type AIProviderStatus = {
  llm: AIProviderId[];
  configured: boolean;
  firecrawl: false;
};

export function getAIProvider(preferred: AIProviderId = "gemini"): AIProviderId | null {
  if (preferred !== "gemini") return null;
  const configured = Boolean(process.env.MAXWEB_AI_API_KEY2?.trim());
  return configured ? "gemini" : null;
}

export function listConfiguredProviders(): AIProviderStatus {
  const configured = getAIProvider() !== null;
  return {
    llm: configured ? ["gemini"] : [],
    configured,
    firecrawl: false,
  };
}

export async function completeAI(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number; maxOutputTokens?: number }
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
