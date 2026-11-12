/**
 * Server-only MAXWEB AI provider helper.
 * MAXWEB_AI_API_KEY  → Z.ai GLM primary
 * MAXWEB_AI_API_KEY2 → Google Gemini fallback
 *
 * Credentials must never reach the browser, API responses, or logs.
 */

const GLM_CHAT_COMPLETIONS_URL =
  "https://api.z.ai/api/paas/v4/chat/completions";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Official Z.AI default in docs is glm-5.3; flash is allowed via env. */
export const DEFAULT_GLM_MODEL = "glm-5.3-flash";
/** Widely supported flash model; override with MAXWEB_GEMINI_MODEL. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

const GLM_TIMEOUT_MS = 25_000;
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
  provider: "glm" | "gemini";
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
  provider: "glm" | "gemini" | "both" | "none";
  httpStatus?: number;
  retryable: boolean;

  constructor(
    code: ProviderErrorCode,
    message: string,
    opts?: {
      provider?: "glm" | "gemini" | "both" | "none";
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
  const glmKey = process.env.MAXWEB_AI_API_KEY?.trim() || "";
  const geminiKey = process.env.MAXWEB_AI_API_KEY2?.trim() || "";
  return { glmKey, geminiKey };
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

function classifyHttpError(
  provider: "glm" | "gemini",
  status: number,
  detail: string
): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(
      provider === "glm" ? "glm_auth_failed" : "gemini_auth_failed",
      provider === "glm"
        ? "GLM authentication failed. Check MAXWEB_AI_API_KEY in Vercel."
        : "Gemini authentication failed. Check MAXWEB_AI_API_KEY2 in Vercel.",
      { provider, httpStatus: status, retryable: false }
    );
  }
  if (status === 429) {
    return new ProviderError(
      "provider_rate_limit",
      `${provider.toUpperCase()} rate limit reached. Please try again shortly.`,
      { provider, httpStatus: status, retryable: true }
    );
  }
  if (status === 503 || status === 502 || status === 504) {
    return new ProviderError(
      "provider_unavailable",
      `${provider.toUpperCase()} is temporarily unavailable.`,
      { provider, httpStatus: status, retryable: true }
    );
  }
  if (status === 400) {
    return new ProviderError("provider_error", detail || "Bad request to provider.", {
      provider,
      httpStatus: status,
      retryable: false,
    });
  }
  return new ProviderError(
    "provider_error",
    `${provider.toUpperCase()} request failed (HTTP ${status}).`,
    { provider, httpStatus: status, retryable: status >= 500 }
  );
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

async function callGlm(
  apiKey: string,
  messages: ChatMessage[],
  options?: { temperature?: number }
): Promise<ProviderResult> {
  const model = process.env.MAXWEB_GLM_MODEL?.trim() || DEFAULT_GLM_MODEL;
  const temperature = Math.min(1, Math.max(0, options?.temperature ?? 0.7));

  let response: Response;
  try {
    response = await fetch(GLM_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": "en-US,en",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(GLM_TIMEOUT_MS),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new ProviderError(
        "provider_timeout",
        "GLM request timed out.",
        { provider: "glm", retryable: true }
      );
    }
    throw new ProviderError(
      "provider_unavailable",
      "GLM network error.",
      { provider: "glm", retryable: true }
    );
  }

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
      model,
    });

    throw classifyHttpError("glm", response.status, providerError.message);
  }

  const data = await response.json();
  const content = extractGlmText(data);
  if (!content) {
    console.error("GLM chat completion returned no text", {
      model,
      finishReason: data?.choices?.[0]?.finish_reason,
    });
    throw new ProviderError("provider_error", "GLM returned an empty response.", {
      provider: "glm",
      retryable: false,
    });
  }

  return {
    content,
    usage: data?.usage ?? null,
    model: data?.model ?? model,
    id: typeof data?.id === "string" ? data.id : null,
    provider: "glm",
  };
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

    throw classifyHttpError("gemini", response.status, providerError.message);
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
 * Historical export name kept for existing routes.
 * Provider order: GLM (MAXWEB_AI_API_KEY) → Gemini (MAXWEB_AI_API_KEY2).
 */
export async function grokChat(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
): Promise<ProviderResult> {
  const { glmKey, geminiKey } = getConfiguredKeys();

  if (!glmKey && !geminiKey) {
    throw new ProviderError(
      "ai_not_configured",
      "MAXWEB AI is not configured. Set MAXWEB_AI_API_KEY and/or MAXWEB_AI_API_KEY2.",
      { provider: "none", retryable: false }
    );
  }

  let glmError: ProviderError | undefined;

  if (glmKey) {
    try {
      return await callGlm(glmKey, messages, options);
    } catch (error) {
      glmError =
        error instanceof ProviderError
          ? error
          : new ProviderError("provider_error", "GLM failed.", {
              provider: "glm",
              retryable: false,
            });

      if (!geminiKey) throw glmError;

      console.warn("GLM primary failed; trying Gemini fallback", {
        code: glmError.code,
        httpStatus: glmError.httpStatus,
      });
    }
  }

  if (geminiKey) {
    try {
      return await callGemini(geminiKey, messages, options);
    } catch (geminiError) {
      const ge =
        geminiError instanceof ProviderError
          ? geminiError
          : new ProviderError("provider_error", "Gemini failed.", {
              provider: "gemini",
              retryable: false,
            });

      if (glmError) {
        throw new ProviderError(
          "providers_unavailable",
          `AI providers unavailable. GLM: ${glmError.message} Gemini: ${ge.message}`,
          { provider: "both", retryable: false }
        );
      }
      throw ge;
    }
  }

  throw (
    glmError ??
    new ProviderError("ai_not_configured", "MAXWEB AI is not configured.", {
      provider: "none",
      retryable: false,
    })
  );
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
