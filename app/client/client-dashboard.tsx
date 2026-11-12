"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "I need a business landing page",
  "Restaurant website with menu",
  "Creative portfolio site",
  "Small online shop",
  "What can I get for ₹10,000?",
];

// From homepage (MAXWEB.zip index.html / script.js)
const WA_PRIMARY = "918106257124"; // +91 81062 57124
const WA_SECONDARY = "918978957342"; // +91 89789 57342
const FAMPAY_UPI = "8978957342@fam";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#080d1c",
    color: "#eef2ff",
    fontFamily: "Manrope, Arial, sans-serif",
    padding: "32px 20px 80px",
  } as React.CSSProperties,
  container: { maxWidth: 920, margin: "0 auto" } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 16,
    borderBottom: "1px solid #27314b",
    paddingBottom: 24,
    marginBottom: 28,
  },
  label: {
    color: "#8ba4d8",
    letterSpacing: 2,
    fontSize: 12,
    margin: 0,
  } as React.CSSProperties,
  h1: { fontSize: 28, margin: "8px 0 0" } as React.CSSProperties,
  link: { color: "#a9c4ff", textDecoration: "none" } as React.CSSProperties,
  card: {
    border: "1px solid #27314b",
    borderRadius: 16,
    padding: 20,
    background: "#10182b",
    marginBottom: 20,
  } as React.CSSProperties,
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
    background: "#1e3a6e",
    borderRadius: "14px 14px 4px 14px",
    padding: "10px 14px",
    maxWidth: "85%",
    fontSize: 14,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap" as const,
  } as React.CSSProperties,
  bubbleAi: {
    alignSelf: "flex-start" as const,
    background: "#17243d",
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
    border: "1px solid #52658e",
    borderRadius: 10,
    padding: "12px 14px",
    background: "#0c1424",
    color: "#eef2ff",
    fontSize: 14,
    outline: "none",
  } as React.CSSProperties,
  btn: {
    border: "1px solid #52658e",
    borderRadius: 10,
    padding: "12px 18px",
    background: "#1a2d52",
    color: "#eef2ff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  } as React.CSSProperties,
  btnDisabled: {
    border: "1px solid #52658e",
    borderRadius: 10,
    padding: "12px 18px",
    background: "#26334d",
    color: "#8e9bb7",
    fontWeight: 600,
    cursor: "wait",
    fontSize: 14,
  } as React.CSSProperties,
  priceTag: {
    display: "inline-block",
    background: "#1a2d52",
    border: "1px solid #3d5a8a",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    color: "#a9c4ff",
    marginBottom: 12,
  } as React.CSSProperties,
  chips: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    border: "1px solid #3d5a8a",
    borderRadius: 999,
    padding: "6px 12px",
    background: "#0c1424",
    color: "#a9c4ff",
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
    border: "1px solid #52658e",
    borderRadius: 12,
    padding: "14px 16px",
    background: "#17243d",
    color: "#eef2ff",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 14,
  } as React.CSSProperties,
  aiBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "#8ba4d8",
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
        "Hi! I’m MAXWEB’s AI consultant (powered by Grok).\n\nTell me what kind of website you need — business, restaurant, portfolio, shop, or something custom — and I’ll help shape the scope and a fair price.\n\nWe start at ₹15,000 and can negotiate down to ₹7,000.",
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
      if (!res.ok) {
        const hint =
          data?.error === "ai_not_configured"
            ? "MAXWEB AI is not configured on this deployment yet. Please contact the admin on WhatsApp below."
            : data?.message ||
              "Sorry, something went wrong. Please try again or contact us on WhatsApp.";
        setMessages((m) => [...m, { role: "assistant", content: hint }]);
      } else {
        if (data.conversationId) setConversationId(data.conversationId);
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
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.label}>MAXWEB CLIENT PORTAL</p>
            <h1 style={styles.h1}>
              {userName ? `Welcome, ${userName}` : "Your dashboard"}
            </h1>
            <p style={{ color: "#8e9bb7", margin: "6px 0 0", fontSize: 14 }}>
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

        <section style={styles.card}>
          <div style={styles.aiBadge}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: busy ? "#f0c14b" : "#7ddea8",
                display: "inline-block",
              }}
            />
            AI CONSULTANT · GROK
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
              <div style={{ ...styles.bubbleAi, color: "#8ba4d8", fontStyle: "italic" }}>
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
            <button type="submit" style={busy ? styles.btnDisabled : styles.btn} disabled={busy}>
              {busy ? "…" : "Send"}
            </button>
          </form>
        </section>

        <section style={styles.card}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Talk to a human admin</h2>
          <p style={{ color: "#8e9bb7", fontSize: 14, marginTop: 0 }}>
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
              <span style={{ display: "block", fontWeight: 400, fontSize: 12, color: "#8e9bb7", marginTop: 4 }}>
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
              <span style={{ display: "block", fontWeight: 400, fontSize: 12, color: "#8e9bb7", marginTop: 4 }}>
                +91 89789 57342
              </span>
            </a>
            <a href={`tel:+${WA_PRIMARY}`} style={styles.contactBtn}>
              Call
              <span style={{ display: "block", fontWeight: 400, fontSize: 12, color: "#8e9bb7", marginTop: 4 }}>
                +91 81062 57124
              </span>
            </a>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Payment (FamPay)</h2>
          <p style={{ color: "#8e9bb7", fontSize: 14, marginTop: 0 }}>
            Pay only after your quote is confirmed on WhatsApp. Same UPI as the homepage.
          </p>
          <div
            style={{
              border: "1px solid #3d5a8a",
              borderRadius: 12,
              padding: 16,
              background: "#0c1424",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "#8ba4d8" }}>FamPay UPI ID</p>
              <code style={{ fontSize: 16, color: "#eef2ff" }}>{FAMPAY_UPI}</code>
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
    </main>
  );
}
