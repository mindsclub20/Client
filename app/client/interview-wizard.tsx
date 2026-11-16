"use client";

import { useMemo, useState } from "react";
import { dash } from "@/app/components/dashboard-shell";
import { LANGUAGES, type LangCode } from "@/lib/consultant/languages";
import { INTERVIEW_STEPS } from "@/lib/consultant/steps";
import type { AnswerValue, Answers } from "@/lib/consultant/types";

function labelOf(
  loc: Record<LangCode, string>,
  lang: LangCode
): string {
  return loc[lang] || loc.en;
}

export default function InterviewWizard({
  onComplete,
}: {
  onComplete: (payload: {
    conversationId: string;
    reply: string;
    currentPrice: number;
    demoRequested: boolean;
  }) => void;
}) {
  const [lang, setLang] = useState<LangCode>("en");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = INTERVIEW_STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / INTERVIEW_STEPS.length) * 100);

  const value = answers[step.id];

  const canNext = useMemo(() => {
    if (!step.required) return true;
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return value.length > 0;
  }, [step, value]);

  function setAnswer(next: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [step.id]: next }));
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/client/interview", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, answers, askAi: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === "missing_required"
            ? `Please complete: ${(data.missing || []).join(", ")}`
            : "Could not save your intake. Try again."
        );
        return;
      }
      onComplete({
        conversationId: data.conversationId,
        reply: data.reply,
        currentPrice: data.currentPrice ?? 15000,
        demoRequested: Boolean(data.demoRequested),
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (stepIndex >= INTERVIEW_STEPS.length - 1) {
      void finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }

  return (
    <section id="intake" style={{ ...dash.card, marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={dash.label}>AI website consultant</p>
          <h2 style={{ fontSize: 20, margin: "6px 0 0" }}>Quick intake</h2>
          <p style={{ ...dash.muted, margin: "8px 0 0", maxWidth: 520 }}>
            Answer a few questions. Gemini helps after this — the <strong>full transcript</strong> goes
            to the MAXWEB team (no AI summary reports).
          </p>
        </div>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as LangCode)}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "#0a2147",
            color: "#eaf1fb",
            padding: "8px 10px",
            fontSize: 13,
          }}
          aria-label="Language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          marginTop: 14,
          height: 6,
          borderRadius: 99,
          background: "rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "linear-gradient(90deg, #2fb5ae, #d29a68)",
          }}
        />
      </div>
      <p style={{ color: dash.mutedColor, fontSize: 12, margin: "8px 0 0" }}>
        Step {stepIndex + 1} of {INTERVIEW_STEPS.length} · {step.section}
      </p>

      <h3 style={{ margin: "16px 0 6px", fontSize: 17 }}>{labelOf(step.label, lang)}</h3>
      <p style={{ ...dash.muted, marginTop: 0 }}>{labelOf(step.prompt, lang)}</p>

      {step.kind === "choice" && step.options ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {step.options.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAnswer(opt.value)}
                style={{
                  ...dash.chip,
                  borderColor: active ? "#2fb5ae" : "rgba(255,255,255,0.14)",
                  background: active ? "rgba(47,181,174,0.2)" : dash.chip.background,
                }}
              >
                {labelOf(opt.label, lang)}
              </button>
            );
          })}
        </div>
      ) : null}

      {step.kind === "multi" && step.options ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {step.options.map((opt) => {
            const selected = Array.isArray(value) ? value.includes(opt.value) : false;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = Array.isArray(value) ? [...value] : [];
                  if (selected) setAnswer(current.filter((v) => v !== opt.value));
                  else setAnswer([...current, opt.value]);
                }}
                style={{
                  ...dash.chip,
                  borderColor: selected ? "#2fb5ae" : "rgba(255,255,255,0.14)",
                  background: selected ? "rgba(47,181,174,0.2)" : dash.chip.background,
                }}
              >
                {labelOf(opt.label, lang)}
              </button>
            );
          })}
        </div>
      ) : null}

      {(step.kind === "text" || step.kind === "phone" || step.kind === "email") && (
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={step.maxLength || 200}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 12,
            padding: "12px 14px",
            background: "rgba(255,255,255,0.06)",
            color: "#eaf1fb",
            fontSize: 14,
          }}
        />
      )}

      {step.kind === "longtext" && (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={step.maxLength || 800}
          rows={4}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 12,
            padding: "12px 14px",
            background: "rgba(255,255,255,0.06)",
            color: "#eaf1fb",
            fontSize: 14,
            resize: "vertical",
          }}
        />
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={stepIndex === 0 || busy}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          style={dash.ghostBtn}
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canNext || busy}
          onClick={next}
          style={!canNext || busy ? dash.ghostBtn : dash.accentBtn}
        >
          {busy
            ? "Saving…"
            : stepIndex >= INTERVIEW_STEPS.length - 1
              ? "Submit & chat with AI"
              : "Continue"}
        </button>
      </div>
      {error ? (
        <p style={{ color: "#ffb6a9", fontSize: 13, marginTop: 10 }}>{error}</p>
      ) : null}
    </section>
  );
}
