/**
 * Server-only MAXWEB AI provider helper.
 * MAXWEB_AI_API_KEY is the xAI/Grok primary key.
 * MAXWEB_AI_API_KEY2 is the Google Gemini fallback key.
 */

const XAI_BASE = "https://api.x.ai/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GROK_MODEL = "grok-4.7";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderResult = {
  content: string;
  usage: unknown;
  model: string;
  id: string | null;
};

function getConfiguredKeys() {
  const xaiKey = process.env.MAXWEB_AI_API_KEY?.trim();
  const geminiKey = process.env.MAXWEB_AI_API_KEY2?.trim();

  if (!xaiKey && !geminiKey) {
    throw new Error("MAXWEB AI is not configured. Add an xAI or Gemini API key to the Preview environment.");
  }

  return { xaiKey, geminiKey };
}

function extractGeminiText(data: any): string {
  const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts
    : [];

  return parts
    .filter((part: any) => typeof part?.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

function extractXaiText(data: any): string {
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

async function callXai(
  apiKey: string,
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
): Promise<ProviderResult> {
  const model =
    options?.model ||
    process.env.MAXWEB_AI_MODEL?.trim() ||
    DEFAULT_GROK_MODEL;

  const response = await fetch(`${XAI_BASE}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: messages,
      temperature: options?.temperature ?? 0.7,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const rawBody = await response.text();
    let payload: any = null;
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = { message: rawBody };
      }
    }
    const providerError = payload?.error ?? payload;
    const message =
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
      message: message.slice(0, 500),
    });

    throw new Error(`xAI request failed (HTTP ${response.status}).`);
  }

  const data = await response.json();
  const content = extractXaiText(data);
  if (!content) throw new Error("xAI returned an empty response.");

  return {
    content,
    usage: data?.usage ?? null,
    model: data?.model ?? model,
    id: data?.id ?? null,
  };
}

async function callGemini(
  apiKey: string,
  messages: ChatMessage[],
  options?: { temperature?: number }
): Promise<ProviderResult> {
  const model =
    process.env.MAXWEB_GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;
  const systemText = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const response = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        ...(systemText
          ? { systemInstruction: { parts: [{ text: systemText }] } }
          : {}),
        contents,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!response.ok) {
    const rawBody = await response.text();
    let payload: any = null;
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = { message: rawBody };
      }
    }
    const providerError = payload?.error ?? payload;
    const message =
      typeof providerError?.message === "string"
        ? providerError.message
        : rawBody;

    console.error("Gemini GenerateContent request rejected", {
      status: response.status,
      contentType: response.headers.get("content-type"),
      code:
        typeof providerError?.code === "number"
          ? providerError.code
          : undefined,
      statusText:
        typeof providerError?.status === "string"
          ? providerError.status
          : undefined,
      message: message.slice(0, 500),
    });

    throw new Error(`Gemini request failed (HTTP ${response.status}).`);
  }

  const data = await response.json();
  const content = extractGeminiText(data);
  if (!content) {
    console.error("Gemini GenerateContent returned no text", {
      model,
      finishReason: data?.candidates?.[0]?.finishReason,
    });
    throw new Error("Gemini returned an empty response.");
  }

  return {
    content,
    usage: data?.usageMetadata ?? null,
    model: data?.modelVersion ?? model,
    id: null,
  };
}

export async function grokChat(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
): Promise<ProviderResult> {
  const { xaiKey, geminiKey } = getConfiguredKeys();
  let xaiError: unknown;

  if (xaiKey) {
    try {
      return await callXai(xaiKey, messages, options);
    } catch (error) {
      xaiError = error;
      if (!geminiKey) throw error;
      console.warn("xAI primary failed; trying configured Gemini fallback.");
    }
  }

  if (geminiKey) {
    try {
      return await callGemini(geminiKey, messages, options);
    } catch (geminiError) {
      if (xaiError instanceof Error && geminiError instanceof Error) {
        throw new Error(
          `AI providers unavailable. xAI: ${xaiError.message} Gemini: ${geminiError.message}`
        );
      }
      throw geminiError;
    }
  }

  throw xaiError instanceof Error
    ? xaiError
    : new Error("MAXWEB AI is not configured.");
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
