/**
 * Server-only MAXWEB AI provider helper.
 * MAXWEB_AI_API_KEY is the Z.ai GLM primary key.
 * MAXWEB_AI_API_KEY2 is the Google Gemini fallback key.
 *
 * Keep this module server-only: provider credentials must never reach the browser.
 */

const GLM_CHAT_COMPLETIONS_URL =
  "https://api.z.ai/api/paas/v4/chat/completions";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const DEFAULT_GLM_MODEL = "glm-5.3-flash";
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
  const glmKey = process.env.MAXWEB_AI_API_KEY?.trim();
  const geminiKey = process.env.MAXWEB_AI_API_KEY2?.trim();

  if (!glmKey && !geminiKey) {
    throw new Error(
      "MAXWEB AI is not configured. Add a GLM or Gemini API key to the server environment."
    );
  }

  return { glmKey, geminiKey };
}

function parseProviderError(rawBody: string): {
  code?: string | number;
  status?: string;
  message: string;
} {
  if (!rawBody) return { message: "The provider returned an empty error response." };

  try {
    const payload = JSON.parse(rawBody);
    const providerError = payload?.error ?? payload;
    return {
      code:
        typeof providerError?.code === "string" ||
        typeof providerError?.code === "number"
          ? providerError.code
          : undefined,
      status:
        typeof providerError?.status === "string"
          ? providerError.status
          : undefined,
      message:
        typeof providerError?.message === "string"
          ? providerError.message
          : rawBody,
    };
  } catch {
    return { message: rawBody };
  }
}

function extractGlmText(data: any): string {
  const message = data?.choices?.[0]?.message;
  const content = message?.content;

  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .filter((part: any) => typeof part?.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim();
  }

  return "";
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

async function callGlm(
  apiKey: string,
  messages: ChatMessage[],
  options?: { temperature?: number }
): Promise<ProviderResult> {
  const model =
    process.env.MAXWEB_GLM_MODEL?.trim() ||
    DEFAULT_GLM_MODEL;
  const temperature = Math.min(
    1,
    Math.max(0, options?.temperature ?? 0.7)
  );

  const response = await fetch(GLM_CHAT_COMPLETIONS_URL, {
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
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const rawBody = await response.text();
    const providerError = parseProviderError(rawBody);

    console.error("GLM chat completion request rejected", {
      status: response.status,
      contentType: response.headers.get("content-type"),
      requestId:
        response.headers.get("x-request-id") ??
        response.headers.get("request-id") ??
        undefined,
      code: providerError.code,
      providerStatus: providerError.status,
      message: providerError.message.slice(0, 500),
    });

    throw new Error(`GLM request failed (HTTP ${response.status}).`);
  }

  const data = await response.json();
  const content = extractGlmText(data);
  if (!content) {
    console.error("GLM chat completion returned no text", {
      model,
      finishReason: data?.choices?.[0]?.finish_reason,
    });
    throw new Error("GLM returned an empty response.");
  }

  return {
    content,
    usage: data?.usage ?? null,
    model: data?.model ?? model,
    id: typeof data?.id === "string" ? data.id : null,
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

  if (contents.length === 0) {
    throw new Error("Gemini requires at least one user or assistant message.");
  }

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
          temperature: Math.min(
            1,
            Math.max(0, options?.temperature ?? 0.7)
          ),
        },
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!response.ok) {
    const rawBody = await response.text();
    const providerError = parseProviderError(rawBody);

    console.error("Gemini GenerateContent request rejected", {
      status: response.status,
      contentType: response.headers.get("content-type"),
      code: providerError.code,
      providerStatus: providerError.status,
      message: providerError.message.slice(0, 500),
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

/**
 * The historical export name is retained because existing MAXWEB routes
 * import grokChat. Provider selection itself is GLM first, Gemini second.
 */
export async function grokChat(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
): Promise<ProviderResult> {
  const { glmKey, geminiKey } = getConfiguredKeys();
  let glmError: unknown;

  if (glmKey) {
    try {
      return await callGlm(glmKey, messages, options);
    } catch (error) {
      glmError = error;
      if (!geminiKey) throw error;
      console.warn("GLM primary failed; trying configured Gemini fallback.");
    }
  }

  if (geminiKey) {
    try {
      return await callGemini(geminiKey, messages, options);
    } catch (geminiError) {
      if (glmError instanceof Error && geminiError instanceof Error) {
        throw new Error(
          `AI providers unavailable. GLM: ${glmError.message} Gemini: ${geminiError.message}`
        );
      }
      throw geminiError;
    }
  }

  throw glmError instanceof Error
    ? glmError
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
