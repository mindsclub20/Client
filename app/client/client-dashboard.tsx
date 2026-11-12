"use client";

import { useState, useRef, useEffect } from "react";
import DashboardShell from "@/app/components/dashboard-shell";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "I need a business landing page",
  "Restaurant website with menu",
  "Creative portfolio site",
  "Small online shop",
  "What can I get for ₹10,000?",
];

const WA_PRIMARY = "918106257124";
const WA_SECONDARY = "918978957342";
const FAMPAY_UPI = "8978957342@fam";

function friendlyAiError(data: { error?: string; message?: string } | null): string {
  const code = data?.error || "";
  if (code === "ai_not_configured") {
    return "MAXWEB AI is not configured on this deployment yet. Please contact the admin on WhatsApp below.";
  }
  if (code === "glm_auth_failed" || code === "gemini_auth_failed") {
    return "AI authentication failed. The site owner needs to check the API keys in Vercel. You can still reach us on WhatsApp.";
  }
  if (code === "provider_rate_limit") {
    return "The AI is busy right now. Please wait a moment and try again.";
  }
  if (
    code === "provider_timeout" ||
    code === "provider_unavailable" ||
    code === "providers_unavailable"
  ) {
    return "The AI service is temporarily unavailable. Please try again shortly, or message us on WhatsApp.";
  }
  return (
    data?.message ||
    "Sorry, something went wrong. Please try again or contact us on WhatsApp."
  );
}

const card: React.CSSProperties = {
  border: "1px solid #ffffff1f",
  borderRadius: 16,
  padding: 20,
  background: "linear-gradient(160deg, #143a72, #0e2d5c)",
  marginBottom: 20,
};

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 16,
    borderBottom: "1px solid #ffffff1f",
    paddingBottom: 24,
    marginBottom: 28,
  },
  label: {
    color: "#9fb3cf",
    letterSpacing: 2,
    fontSize: 12,
    margin: 0,
  } as React.CSSProperties,
  h1: {
    fontFamily: "Instrument Serif, Georgia, serif",
    fontWeight: 400,
    fontSize: 28,
    margin: "8px 0 0",
  } as React.CSSProperties,
  link: { color: "#eaf1fb", textDecoration: "none" } as React.CSSProperties,
  chatBox: {
    height: 380,
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    marginBottom: 14,
    paddingRight: 4,
  },
  bubbleUser: {
    alignSelf: "flex-end" as const,
    background: "#1b4a86",
    borderRadius: "14px 14px 4px 14px",
    padding: "10px 14px",
    maxWidth: "85%",
    fontSize: 14,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap" as const,
  } as React.CSSProperties,
  bubbleAi: {
    alignSelf: "flex-start" as const,
    background: "#0a2147",
    border: "1px solid #ffffff1f",
    borderRadius: "14px 14px 14px 4px",
    padding: "10px 14px",
    maxWidth: "85%",
    fontSize: 14,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap" as const,
  } as React.CSSProperties,
  form: { display: "flex", gap: 10 } as React.CSSProperties,
  input: {
    flex: 1,
    border: "1px solid #ffffff2e",
    borderRadius: 12,
    padding: "12px 14px",
    background: "#ffffff0d",
    color: "#eaf1fb",
    fontSize: 14,
    outline: "none",
  } as React.CSSProperties,
  btn: {
    border: "1px solid #ffffff40",
    borderRadius: 12,
    padding: "12px 18px",
    background: "transparent",
    color: "#eaf1fb",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  } as React.CSSProperties,
  btnDisabled: {
    border: "1px solid #ffffff20",
    borderRadius: 12,
    padding: "12px 18px",
    background: "#ffffff08",
    color: "#9fb3cf",
    fontWeight: 600,
    cursor: "wait",
    fontSize: 14,
  } as React.CSSProperties,
  priceTag: {
    display: "inline-block",
    background: "#0a2147",
    border: "1px solid #ffffff1f",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    color: "#d29a68",
    marginBottom: 12,
  } as React.CSSProperties,
  chips: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    border: "1px solid #ffffff1f",
    borderRadius: 999,
    padding: "6px 12px",
    background: "#0a2147",
    color: "#eaf1fb",
    fontSize: 12,
    cursor: "pointer",
  } as React.CSSProperties,
  contactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
  } as React.CSSProperties,
  contactBtn: {
    display: "block",
    textAlign: "center" as const,
    border: "1px solid #ffffff1f",
    borderRadius: 12,
    padding: "14px 16px",
    background: "#0a2147",
    color: "#eaf1fb",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 14,
  } as React.CSSProperties,
  aiBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "#9fb3cf",
    letterSpacing: 1,
    marginBottom: 10,
  } as React.CSSProperties,
};

export default function ClientDashboard({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName: string | null;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi! I’m MAXWEB’s AI consultant.\n\nTell me what kind of website you need — business, restaurant, portfolio, shop, or something custom — and I’ll help shape the scope and a fair price.\n\nWe start at ₹15,000 and can negotiate down to ₹7,000.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState(15000);
  const [agreedPrice, setAgreedPrice] = useState<number | null>(null);
  const [showChips, setShowChips] = useState(true);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function sendText(text: string) {
    const cleaned = text.trim();
    if (!cleaned || busy) return;
    setShowChips(false);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: cleaned }]);
    setBusy(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cleaned, conversationId }),
      });
      const data = await res.json();
      if (data?.conversationId) setConversationId(data.conversationId);
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: friendlyAiError(data) }]);
      } else {
        if (typeof data.currentPrice === "number") setCurrentPrice(data.currentPrice);
        if (data.agreedPrice) setAgreedPrice(data.agreedPrice);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.reply || "…" },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Could not reach the server. Check your connection and try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function copyUpi() {
    navigator.clipboard?.writeText(FAMPAY_UPI).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const waMsg = encodeURIComponent(
    `Hi MAXWEB, I am a client (${userEmail}) and need help with my website project.`
  );

  return (
    <DashboardShell>
      <div style={{ padding: "32px 20px 80px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <header style={styles.header}>
            <div>
              <p style={styles.label}>MAXWEB CLIENT PORTAL</p>
              <h1 style={styles.h1}>
                {userName ? `Welcome, ${userName}` : "Your dashboard"}
              </h1>
              <p style={{ color: "#9fb3cf", margin: "6px 0 0", fontSize: 14 }}>
                {userEmail}
              </p>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <a href="/" style={styles.link}>
                View website
              </a>
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/auth/sign-out", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                  });
                  window.location.replace("/#login");
                }}
                style={styles.btn}
              >
                Log out
              </button>
            </div>
          </header>

          <section style={card}>
            <div style={styles.aiBadge}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: busy ? "#d29a68" : "#2fb5ae",
                  display: "inline-block",
                }}
              />
              AI CONSULTANT · GEMINI
            </div>

            <div style={styles.priceTag}>
              {agreedPrice
                ? `Agreed price: ₹${agreedPrice.toLocaleString("en-IN")}`
                : `Current discussion: ₹${currentPrice.toLocaleString("en-IN")} · floor ₹7,000`}
            </div>

            <div style={styles.chatBox}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={m.role === "user" ? styles.bubbleUser : styles.bubbleAi}
                >
                  {m.content}
                </div>
              ))}
              {busy ? (
                <div style={{ ...styles.bubbleAi, color: "#9fb3cf", fontStyle: "italic" }}>
                  AI is thinking…
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {showChips && !busy ? (
              <div style={styles.chips}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={styles.chip}
                    onClick={() => sendText(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}

            <form
              style={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                sendText(input);
              }}
            >
              <input
                style={styles.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe the website you need…"
                disabled={busy}
                aria-label="Message to AI consultant"
              />
              <button
                type="submit"
                style={busy ? styles.btnDisabled : styles.btn}
                disabled={busy}
              >
                {busy ? "…" : "Send"}
              </button>
            </form>
          </section>

          <section style={card}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Talk to a human admin</h2>
            <p style={{ color: "#9fb3cf", fontSize: 14, marginTop: 0 }}>
              Same numbers as the homepage — WhatsApp the founders directly.
            </p>
            <div style={styles.contactGrid}>
              <a
                href={`https://wa.me/${WA_PRIMARY}?text=${waMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.contactBtn}
              >
                WhatsApp
                <span
                  style={{
                    display: "block",
                    fontWeight: 400,
                    fontSize: 12,
                    color: "#9fb3cf",
                    marginTop: 4,
                  }}
                >
                  +91 81062 57124
                </span>
              </a>
              <a
                href={`https://wa.me/${WA_SECONDARY}?text=${waMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.contactBtn}
              >
                WhatsApp
                <span
                  style={{
                    display: "block",
                    fontWeight: 400,
                    fontSize: 12,
                    color: "#9fb3cf",
                    marginTop: 4,
                  }}
                >
                  +91 89789 57342
                </span>
              </a>
              <a href={`tel:+${WA_PRIMARY}`} style={styles.contactBtn}>
                Call
                <span
                  style={{
                    display: "block",
                    fontWeight: 400,
                    fontSize: 12,
                    color: "#9fb3cf",
                    marginTop: 4,
                  }}
                >
                  +91 81062 57124
                </span>
              </a>
            </div>
          </section>

          <section style={card}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Payment (FamPay)</h2>
            <p style={{ color: "#9fb3cf", fontSize: 14, marginTop: 0 }}>
              Pay only after your quote is confirmed on WhatsApp. Same UPI as the homepage.
            </p>
            <div
              style={{
                border: "1px solid #ffffff1f",
                borderRadius: 12,
                padding: 16,
                background: "#0a2147",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#9fb3cf" }}>FamPay UPI ID</p>
                <code style={{ fontSize: 16, color: "#eaf1fb" }}>{FAMPAY_UPI}</code>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={copyUpi} style={styles.btn}>
                  {copied ? "Copied" : "Copy ID"}
                </button>
                <a
                  href={`upi://pay?pa=${encodeURIComponent(FAMPAY_UPI)}&pn=MAXWEB&cu=INR`}
                  style={{ ...styles.btn, textDecoration: "none" }}
                >
                  Pay now
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
