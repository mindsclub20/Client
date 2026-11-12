/* Server-only Gemini provider. Credentials must never reach the browser or logs. */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_MAX_ATTEMPTS = 3;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderResult = {
  content: string;
  usage: unknown;
  model: string;
  id: string | null;
  provider: "gemini";
};

export type ProviderErrorCode =
  | "ai_not_configured"
  | "glm_auth_failed"
  | "gemini_auth_failed"
  | "provider_rate_limit"
  | "provider_unavailable"
  | "provider_timeout"
  | "providers_unavailable"
  | "provider_error";

export class ProviderError extends Error {
  code: ProviderErrorCode;
  provider: "gemini" | "none";
  httpStatus?: number;
  retryable: boolean;

  constructor(
    code: ProviderErrorCode,
    message: string,
    opts?: {
      provider?: "gemini" | "none";
      httpStatus?: number;
      retryable?: boolean;
    }
  ) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.provider = opts?.provider ?? "none";
    this.httpStatus = opts?.httpStatus;
    this.retryable = opts?.retryable ?? false;
  }
}

function getConfiguredKeys() {
  const geminiKey = process.env.MAXWEB_AI_API_KEY2?.trim() || "";
  return { geminiKey };
}

function parseProviderError(rawBody: string): {
  code?: string | number;
  status?: string;
  message: string;
} {
  if (!rawBody) return { message: "empty error body" };
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
          : rawBody.slice(0, 500),
    };
  } catch {
    return { message: rawBody.slice(0, 500) };
  }
}

function classifyHttpError(status: number, detail: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(
      "gemini_auth_failed",
      "Gemini authentication failed. Check MAXWEB_AI_API_KEY2 in Vercel.",
      { provider: "gemini", httpStatus: status, retryable: false }
    );
  }
  if (status === 429) {
    return new ProviderError("provider_rate_limit", "Gemini rate limit reached. Please try again shortly.", {
      provider: "gemini", httpStatus: status, retryable: true,
    });
  }
  if (status === 503 || status === 502 || status === 504) {
    return new ProviderError("provider_unavailable", "Gemini is temporarily unavailable.", {
      provider: "gemini", httpStatus: status, retryable: true,
    });
  }
  if (status === 400) {
    return new ProviderError("provider_error", detail || "Bad request to Gemini.", {
      provider: "gemini", httpStatus: status, retryable: false,
    });
  }
  return new ProviderError("provider_error", `Gemini request failed (HTTP ${status}).`, {
    provider: "gemini", httpStatus: status, retryable: status >= 500,
  });
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "TimeoutError" || name === "AbortError";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const base = 400 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(4_000, base + jitter);
}

function extractGlmText(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
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

async function callGeminiOnce(
  apiKey: string,
  messages: ChatMessage[],
  options?: { temperature?: number }
): Promise<ProviderResult> {
  const model = process.env.MAXWEB_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
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
    throw new ProviderError(
      "provider_error",
      "Gemini requires at least one user or assistant message.",
      { provider: "gemini", retryable: false }
    );
  }

  let response: Response;
  try {
    response = await fetch(
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
            temperature: Math.min(1, Math.max(0, options?.temperature ?? 0.7)),
          },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw new ProviderError(
        "provider_timeout",
        "Gemini request timed out.",
        { provider: "gemini", retryable: true }
      );
    }
    throw new ProviderError(
      "provider_unavailable",
      "Gemini network error.",
      { provider: "gemini", retryable: true }
    );
  }

  if (!response.ok) {
    const rawBody = await response.text();
    const providerError = parseProviderError(rawBody);

    console.error("Gemini GenerateContent request rejected", {
      status: response.status,
      contentType: response.headers.get("content-type"),
      code: providerError.code,
      providerStatus: providerError.status,
      message: providerError.message.slice(0, 500),
      model,
    });

    throw classifyHttpError(response.status, providerError.message);
  }

  const data = await response.json();
  const content = extractGeminiText(data);
  if (!content) {
    console.error("Gemini GenerateContent returned no text", {
      model,
      finishReason: data?.candidates?.[0]?.finishReason,
    });
    throw new ProviderError(
      "provider_error",
      "Gemini returned an empty response.",
      { provider: "gemini", retryable: false }
    );
  }

  return {
    content,
    usage: data?.usageMetadata ?? null,
    model: data?.modelVersion ?? model,
    id: null,
    provider: "gemini",
  };
}

async function callGemini(
  apiKey: string,
  messages: ChatMessage[],
  options?: { temperature?: number }
): Promise<ProviderResult> {
  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
    try {
      return await callGeminiOnce(apiKey, messages, options);
    } catch (error) {
      const pe =
        error instanceof ProviderError
          ? error
          : new ProviderError("provider_error", "Gemini failed.", {
              provider: "gemini",
              retryable: false,
            });
      lastError = pe;

      // Never retry auth / client errors
      if (
        !pe.retryable ||
        pe.code === "gemini_auth_failed" ||
        pe.httpStatus === 400 ||
        pe.httpStatus === 401 ||
        pe.httpStatus === 403
      ) {
        throw pe;
      }

      if (attempt < GEMINI_MAX_ATTEMPTS - 1) {
        const wait = backoffMs(attempt);
        console.warn("Gemini transient failure; retrying", {
          attempt: attempt + 1,
          code: pe.code,
          httpStatus: pe.httpStatus,
          waitMs: wait,
        });
        await sleep(wait);
        continue;
      }
      throw pe;
    }
  }

  throw (
    lastError ??
    new ProviderError("provider_unavailable", "Gemini unavailable.", {
      provider: "gemini",
      retryable: true,
    })
  );
}

/**
 * Historical export name retained for the existing API route.
 * Gemini is the sole provider and reads only MAXWEB_AI_API_KEY2.
 */
export async function grokChat(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
): Promise<ProviderResult> {
  const { geminiKey } = getConfiguredKeys();

  if (!geminiKey) {
    throw new ProviderError(
      "ai_not_configured",
      "MAXWEB AI is not configured. Set MAXWEB_AI_API_KEY2 (Gemini) in Vercel.",
      { provider: "none", retryable: false }
    );
  }

  return callGemini(geminiKey, messages, options);
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
