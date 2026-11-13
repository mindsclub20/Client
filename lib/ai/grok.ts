/* Server-only Gemini provider. Credentials must never reach the browser or logs. */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Prefer the fastest lite model for chat latency; fall back to fuller Flash
 * models if lite is unavailable or capacity-constrained.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export const GEMINI_MODEL_FALLBACKS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
] as const;

const GEMINI_TIMEOUT_MS = 18_000;
const GEMINI_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_OUTPUT_TOKENS = 320;

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
  | "gemini_auth_failed"
  | "provider_rate_limit"
  | "provider_unavailable"
  | "provider_timeout"
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

export function normalizeGeminiModel(value?: string): string {
  const configuredModel = value?.trim() || DEFAULT_GEMINI_MODEL;
  const model = configuredModel.startsWith("models/")
    ? configuredModel.slice("models/".length)
    : configuredModel;
  if (!/^[A-Za-z0-9._-]+$/.test(model)) {
    throw new ProviderError(
      "provider_error",
      "Invalid Gemini model configuration.",
      { provider: "gemini", retryable: false }
    );
  }
  return model;
}

function resolveModelCandidates(preferred?: string): string[] {
  const primary = normalizeGeminiModel(
    preferred || process.env.MAXWEB_GEMINI_MODEL
  );
  const ordered = [primary, ...GEMINI_MODEL_FALLBACKS];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ordered) {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  return unique;
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

function isModelNotFound(status: number, detail: string, code?: string | number): boolean {
  if (status === 404) return true;
  const text = `${code ?? ""} ${detail}`.toLowerCase();
  return text.includes("not_found") || text.includes("is not found") || text.includes("unknown model");
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
    return new ProviderError(
      "provider_rate_limit",
      "Gemini rate limit reached. Please try again shortly.",
      { provider: "gemini", httpStatus: status, retryable: true }
    );
  }
  if (status === 503 || status === 502 || status === 504) {
    return new ProviderError(
      "provider_unavailable",
      "Gemini is temporarily unavailable due to high demand. Please try again in a moment.",
      { provider: "gemini", httpStatus: status, retryable: true }
    );
  }
  if (status === 400) {
    return new ProviderError("provider_error", detail || "Bad request to Gemini.", {
      provider: "gemini",
      httpStatus: status,
      retryable: false,
    });
  }
  return new ProviderError(
    "provider_error",
    `Gemini request failed (HTTP ${status}).`,
    { provider: "gemini", httpStatus: status, retryable: status >= 500 }
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
  return Math.min(3_000, base + jitter);
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
  model: string,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<ProviderResult> {
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
      `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`,
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
            temperature: Math.min(1, Math.max(0, options?.temperature ?? 0.5)),
            maxOutputTokens: options?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw new ProviderError("provider_timeout", "Gemini request timed out.", {
        provider: "gemini",
        retryable: true,
      });
    }
    throw new ProviderError("provider_unavailable", "Gemini network error.", {
      provider: "gemini",
      retryable: true,
    });
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

    if (isModelNotFound(response.status, providerError.message, providerError.code)) {
      throw new ProviderError(
        "provider_error",
        `Gemini model unavailable: ${model}`,
        { provider: "gemini", httpStatus: response.status, retryable: false }
      );
    }

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

async function callGeminiWithRetries(
  apiKey: string,
  messages: ChatMessage[],
  model: string,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<ProviderResult> {
  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
    try {
      return await callGeminiOnce(apiKey, messages, model, options);
    } catch (error) {
      const pe =
        error instanceof ProviderError
          ? error
          : new ProviderError("provider_error", "Gemini failed.", {
              provider: "gemini",
              retryable: false,
            });
      lastError = pe;

      if (
        !pe.retryable ||
        pe.code === "gemini_auth_failed" ||
        pe.httpStatus === 400 ||
        pe.httpStatus === 401 ||
        pe.httpStatus === 403 ||
        pe.httpStatus === 404
      ) {
        throw pe;
      }

      if (attempt < GEMINI_MAX_ATTEMPTS - 1) {
        const wait = backoffMs(attempt);
        console.warn("Gemini transient failure; retrying", {
          attempt: attempt + 1,
          code: pe.code,
          httpStatus: pe.httpStatus,
          model,
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

async function callGemini(
  apiKey: string,
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number; maxOutputTokens?: number }
): Promise<ProviderResult> {
  const candidates = resolveModelCandidates(options?.model);
  let lastError: ProviderError | undefined;

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    try {
      return await callGeminiWithRetries(apiKey, messages, model, options);
    } catch (error) {
      const pe =
        error instanceof ProviderError
          ? error
          : new ProviderError("provider_error", "Gemini failed.", {
              provider: "gemini",
              retryable: false,
            });
      lastError = pe;

      if (pe.code === "gemini_auth_failed" || pe.code === "ai_not_configured") {
        throw pe;
      }

      const tryNext =
        pe.httpStatus === 404 ||
        (pe.message || "").toLowerCase().includes("model unavailable") ||
        pe.code === "provider_unavailable" ||
        pe.code === "provider_timeout";

      if (tryNext && i < candidates.length - 1) {
        console.warn("Gemini model failed; trying fallback model", {
          failedModel: model,
          nextModel: candidates[i + 1],
          code: pe.code,
          httpStatus: pe.httpStatus,
        });
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

export async function grokChat(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number; maxOutputTokens?: number }
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

export const BARGAIN_SYSTEM_PROMPT = `You are MAXWEB's website consultant and pricing negotiator.
Rules:
1. Learn the website type (business, portfolio, restaurant, shop, landing, custom).
2. Ask short clarifying questions when needed.
3. Start at ₹15,000; never go below ₹7,000.
4. Be concise (under 120 words unless asked for detail).
5. Propose a fair package price and brief scope when ready.
6. If the client accepts a price, say it is pending admin approval — never finalize it yourself.
7. Currency is ₹. Do not invent features or name competitors.
8. Offer human WhatsApp help if they prefer a person.
`;

export const SUMMARY_SYSTEM_PROMPT = `You summarize MAXWEB client AI consultations for the admin dashboard.
Write 2–4 short sentences covering: website type, key requirements, latest discussed price (₹), and next step.
No markdown, no bullet lists, no greeting. Plain text only. Max 80 words.`;
