/**
 * Server-only xAI Grok helper.
 * Uses only the approved env var names from MAXWEB AI Credentials Policy:
 * MAXWEB_AI_API_KEY or MAXWEB_AI_API_KEY2
 * Endpoint: https://api.x.ai/v1
 */

const XAI_BASE = "https://api.x.ai/v1";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getApiKey(): string {
  const key =
    process.env.MAXWEB_AI_API_KEY ||
    process.env.MAXWEB_AI_API_KEY2 ||
    "";
  if (!key) {
    throw new Error(
      "MAXWEB AI key missing. Set MAXWEB_AI_API_KEY or MAXWEB_AI_API_KEY2 in server environment variables."
    );
  }
  return key;
}

export async function grokChat(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
) {
  const apiKey = getApiKey();
  const model = options?.model || "grok-4-0709";
  const temperature = options?.temperature ?? 0.7;

  const response = await fetch(`${XAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Grok API error ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const content =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    "";
  return {
    content: String(content),
    usage: data?.usage ?? null,
    model: data?.model ?? model,
    id: data?.id ?? null,
  };
}

export const BARGAIN_SYSTEM_PROMPT = `You are MAXWEB's expert website consultant and pricing negotiator.
Your job:
1. Understand what kind of website the client needs (business, portfolio, restaurant, e-commerce, landing page, custom, etc.).
2. Ask clarifying questions about pages, features, branding, timeline, and goals.
3. Start price discussion at ₹15,000.
4. You may negotiate downward, but never go below ₹7,000. The absolute floor is 7000.
5. Be professional, friendly, concise, and helpful. Keep replies under 180 words unless the client asks for detail.
6. When you have enough information, propose a final package price and brief scope.
7. If the client accepts a price, confirm it clearly so the system can record the agreed_price.
8. Currency is Indian Rupees (₹). Always show numbers clearly.
9. Do not invent features the client did not ask for. Do not discuss competitors by name.
10. If the client wants to speak to a human admin instead, politely offer that option.

Current negotiation rules:
- Starting price: 15000
- Minimum allowed: 7000
- Prefer landing between 9000–14000 for typical brochure / small business sites.
`;
