/**
 * Server-only xAI Grok helper.
 * Uses MAXWEB_AI_API_KEY as primary and MAXWEB_AI_API_KEY2 as fallback.
 * Grok 4.7 is called through xAI's recommended Responses API.
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
  const uniqueKeys = [...new Set(keys.map((key) => key.trim()))];
  if (!uniqueKeys.length) {
    throw new Error("MAXWEB AI is not configured. Add an xAI API key to the Preview environment.");
  }
  return uniqueKeys;
}

function extractResponseText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const parts = Array.isArray(data?.output)
    ? data.output.flatMap((item: any) =>
        Array.isArray(item?.content) ? item.content : []
      )
    : [];

  return parts
    .filter(
      (part: any) =>
        (part?.type === "output_text" || part?.type === "text") &&
        typeof part?.text === "string"
    )
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

export async function grokChat(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
) {
  const apiKeys = getApiKeys();
  const model =
    options?.model ||
    process.env.MAXWEB_AI_MODEL?.trim() ||
    DEFAULT_GROK_MODEL;
  const temperature = options?.temperature ?? 0.7;
  let lastStatus: number | undefined;

  for (let index = 0; index < apiKeys.length; index += 1) {
    try {
      const response = await fetch(`${XAI_BASE}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKeys[index]}`,
        },
        body: JSON.stringify({
          model,
          input: messages,
          temperature,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        lastStatus = response.status;
        // Read the body as text first: upstream gateways sometimes return
        // plain text or HTML instead of JSON for 4xx responses.
        const rawBody = await response.text();
        let errorPayload: any = null;
        if (rawBody) {
          try {
            errorPayload = JSON.parse(rawBody);
          } catch {
            errorPayload = { message: rawBody };
          }
        }
        const providerError = errorPayload?.error ?? errorPayload;
        const providerMessage =
          typeof providerError?.message === "string"
            ? providerError.message
            : rawBody;
        console.error("xAI Responses request rejected", {
          status: response.status,
          contentType: response.headers.get("content-type"),
          requestId:
            response.headers.get("x-request-id") ??
            response.headers.get("request-id") ??
            undefined,
          code:
            typeof providerError?.code === "string"
              ? providerError.code
              : undefined,
          type:
            typeof providerError?.type === "string"
              ? providerError.type
              : undefined,
          param:
            typeof providerError?.param === "string"
              ? providerError.param
              : undefined,
          message: providerMessage.slice(0, 500),
          keySlot: index === 0 ? "primary" : "secondary",
        });

        if (index < apiKeys.length - 1) continue;

        if (response.status === 400) {
          throw new Error(
            "xAI rejected the request (HTTP 400). Check the xAI API key and request configuration."
          );
        }
        throw new Error(`xAI request failed (HTTP ${response.status}).`);
      }

      const data = await response.json();
      const content = extractResponseText(data);
      if (!content) {
        console.error("xAI Responses API returned no text", {
          model: data?.model ?? model,
          status: data?.status,
        });
        throw new Error("xAI returned an empty response.");
      }

      return {
        content,
        usage: data?.usage ?? null,
        model: data?.model ?? model,
        id: data?.id ?? null,
      };
    } catch (error) {
      if (index === apiKeys.length - 1) {
        if (error instanceof Error && error.message.startsWith("xAI")) {
          throw error;
        }
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
