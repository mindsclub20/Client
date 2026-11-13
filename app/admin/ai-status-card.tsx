import { listConfiguredProviders } from "@/lib/ai/provider";
import { normalizeGeminiModel } from "@/lib/ai/grok";

const PANEL = {
  border: "1px solid #ffffff1f",
  borderRadius: 14,
  padding: 18,
  background: "linear-gradient(160deg, #143a72, #0e2d5c)",
} as const;

type ProbeResult = {
  ok: boolean;
  model: string;
  label: string;
  detail: string;
};

async function probeGemini(): Promise<ProbeResult> {
  const model = normalizeGeminiModel(process.env.MAXWEB_GEMINI_MODEL);
  const configured = listConfiguredProviders().configured;
  const apiKey = process.env.MAXWEB_AI_API_KEY2?.trim();

  if (!configured || !apiKey) {
    return {
      ok: false,
      model,
      label: "Not configured",
      detail: "Set MAXWEB_AI_API_KEY2 on the server environment.",
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
      {
        method: "GET",
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(6_000),
        cache: "no-store",
      }
    );

    if (response.ok) {
      return {
        ok: true,
        model,
        label: "Online",
        detail: "Gemini model metadata reachable. Chat and summaries can run.",
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        model,
        label: "Auth failed",
        detail: "Gemini rejected the API key. Rotate MAXWEB_AI_API_KEY2.",
      };
    }
    if (response.status === 404) {
      return {
        ok: false,
        model,
        label: "Model missing",
        detail: `Model ${model} was not found for this key.`,
      };
    }
    if (response.status === 429) {
      return {
        ok: false,
        model,
        label: "Rate limited",
        detail: "Gemini rate limit hit. Try again shortly.",
      };
    }
    return {
      ok: false,
      model,
      label: "Unavailable",
      detail: `Gemini returned HTTP ${response.status}.`,
    };
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      model,
      label: timedOut ? "Timeout" : "Network error",
      detail: timedOut
        ? "Gemini probe timed out."
        : "Could not reach Gemini from the server.",
    };
  }
}

export default async function AdminAIStatusCard() {
  const probe = await probeGemini();
  const providers = listConfiguredProviders();

  return (
    <section style={{ ...PANEL, marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <p style={{ color: "#9fb3cf", fontSize: 12, margin: 0, letterSpacing: 1 }}>
            AI PROVIDER
          </p>
          <h2 style={{ fontSize: 18, margin: "8px 0 4px" }}>Gemini integration</h2>
          <p style={{ color: "#9fb3cf", fontSize: 13, margin: 0 }}>
            Sole provider · key stays server-side · model probe does not spend chat tokens
          </p>
        </div>
        <span
          style={{
            fontWeight: 700,
            color: probe.ok ? "#55d6ad" : "#ffb6a9",
            fontSize: 14,
          }}
        >
          {probe.label}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        <div style={{ ...PANEL, padding: 14 }}>
          <p style={{ color: "#9fb3cf", fontSize: 11, margin: 0 }}>PROVIDER</p>
          <p style={{ margin: "6px 0 0", fontWeight: 600 }}>
            {providers.llm[0] || "none"}
          </p>
        </div>
        <div style={{ ...PANEL, padding: 14 }}>
          <p style={{ color: "#9fb3cf", fontSize: 11, margin: 0 }}>MODEL</p>
          <p style={{ margin: "6px 0 0", fontWeight: 600 }}>{probe.model}</p>
        </div>
        <div style={{ ...PANEL, padding: 14 }}>
          <p style={{ color: "#9fb3cf", fontSize: 11, margin: 0 }}>KEY ENV</p>
          <p style={{ margin: "6px 0 0", fontWeight: 600 }}>MAXWEB_AI_API_KEY2</p>
        </div>
      </div>

      <p style={{ color: "#d4dfef", fontSize: 13, margin: "14px 0 0", lineHeight: 1.45 }}>
        {probe.detail}
      </p>
    </section>
  );
}
