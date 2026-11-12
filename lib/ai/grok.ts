/**
 * Server-only xAI Grok helper.
 * Uses MAXWEB_AI_API_KEY as primary and MAXWEB_AI_API_KEY2 as fallback.
 * Endpoint: https://api.x.ai/v1
 */

const XAI_BASE = "https://api.x.ai/v1";
export const DEFAULT_GROK_MODEL = "grok-4.7";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getApiKeys(): string[] {
  const keys = [
    process.env.MAXWEB_AI_API_KEY,
    process.env.MAXWEB_AI_API_KEY2,
  ].filter((key): key is string => Boolean(key?.trim()));
  const uniqueKeys = [...new Set(keys)];
  if (!uniqueKeys.length) {
    throw new Error("MAXWEB AI is not configured.");
  }
  return uniqueKeys;
}

export async function grokChat(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
) {
  const apiKeys = getApiKeys();
  // Allow an explicit server-side override while defaulting to a current xAI model.
  const model =
    options?.model ||
    process.env.MAXWEB_AI_MODEL?.trim() ||
    DEFAULT_GROK_MODEL;
  const temperature = options?.temperature ?? 0.7;
  let lastStatus: number | undefined;

  for (let index = 0; index < apiKeys.length; index += 1) {
    try {
      const response = await fetch(`${XAI_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKeys[index]}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          stream: false,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        lastStatus = response.status;
        // Try the secondary key if the primary key is rejected or rate-limited.
        if (index < apiKeys.length - 1) continue;
        throw new Error("AI provider request failed.");
      }

      const data = await response.json();
      const content =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        "";
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("AI provider returned an empty response.");
      }

      return {
        content,
        usage: data?.usage ?? null,
        model: data?.model ?? model,
        id: data?.id ?? null,
      };
    } catch {
      if (index === apiKeys.length - 1) {
        throw new Error(
          lastStatus
            ? `AI provider unavailable (HTTP ${lastStatus}).`
            : "AI provider unavailable. Please try again."
        );
      }
    }
  }

  throw new Error("AI provider unavailable. Please try again.");
}

export const BARGAIN_SYSTEM_PROMPT = `You are MAXWEB's expert website consultant and pricing negotiator.
Your job:
1. Understand what kind of website the client needs (business, portfolio, restaurant, e-commerce, landing page, custom, etc.).
2. Ask clarifying questions about pages, features, branding, timeline, and goals.
3. Start price discussion at ₹15,000.
4. You may negotiate downward, but never go below ₹7,000. The absolute floor is 7000.
5. Be professional, friendly, and concise. Keep replies under 180 words unless the client asks for detail.
6. When you have enough information, propose a final package price and brief scope.
7. If the client says they accept a price, acknowledge their request and explain that the quotation remains pending until a MAXWEB admin reviews and approves it. Never claim the quote is finalized, booked, or approved.
8. Currency is Indian Rupees (₹). Always show numbers clearly.
9. Do not invent features the client did not ask for. Do not discuss competitors by name.
10. If the client wants to speak to a human admin instead, politely offer that option.

Current negotiation rules:
- Starting price: 15000
- Minimum allowed: 7000
- Prefer landing between 9000–14000 for typical brochure / small business sites.
- You may propose prices, but cannot approve quotations or mark projects completed. Only an authorized MAXWEB admin can approve a quote after the customer's explicit acceptance.
`;
