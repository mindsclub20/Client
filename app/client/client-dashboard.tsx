"use client";

import { useState, useRef, useEffect } from "react";
import DashboardShell, { dash } from "@/app/components/dashboard-shell";

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

const JOURNEY = [
  {
    step: "01",
    title: "Share your idea",
    text: "Tell us the business, audience, and pages you need.",
  },
  {
    step: "02",
    title: "Shape the package",
    text: "We refine scope and a fair price between ₹15,000 and ₹7,000.",
  },
  {
    step: "03",
    title: "Approve & build",
    text: "Admin confirms the quote, then design and delivery begin.",
  },
];

const HIGHLIGHTS = [
  {
    title: "Live demos",
    text: "Browse working sample sites before you commit.",
    href: "/#demos",
    cta: "See demos",
  },
  {
    title: "Human support",
    text: "WhatsApp the founders anytime — same numbers as the homepage.",
    href: "#human-help",
    cta: "Contact",
  },
  {
    title: "Clear pricing",
    text: "Transparent negotiation. No hidden packages.",
    href: "#consultant",
    cta: "Discuss price",
  },
];

function friendlyAiError(data: { error?: string; message?: string } | null): string {
  const code = data?.error || "";
  if (code === "ai_not_configured") {
    return "MAXWEB AI is not configured on this deployment yet. Please contact the admin on WhatsApp below.";
  }
  if (code === "glm_auth_failed" || code === "gemini_auth_failed") {
    return "AI authentication failed. The site owner needs to check the API keys. You can still reach us on WhatsApp.";
  }
  if (code === "provider_rate_limit") {
    return "The assistant is busy right now. Please wait a moment and try again.";
  }
  if (
    code === "provider_timeout" ||
    code === "provider_unavailable" ||
    code === "providers_unavailable"
  ) {
    return "The assistant is temporarily unavailable. Please try again shortly, or message us on WhatsApp.";
  }
  return (
    data?.message ||
    "Sorry, something went wrong. Please try again or contact us on WhatsApp."
  );
}

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
        "Hi! I’m MAXWEB’s consultant.\n\nTell me what kind of website you need — business, restaurant, portfolio, shop, or something custom — and I’ll help shape the scope and a fair price.\n\nWe start at ₹15,000 and can negotiate down to ₹7,000.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState(15000);
  const [agreedPrice, setAgreedPrice] = useState<number | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<
    "none" | "pending_admin" | "approved" | "rejected"
  >("none");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [showChips, setShowChips] = useState(true);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    fetch("/api/ai/quote/status", { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const quote = data?.quote;
        if (quote) {
          setQuoteStatus(quote.status);
          setConversationId(quote.conversation_id);
          setCurrentPrice(quote.proposed_price);
          if (quote.status === "approved") setAgreedPrice(quote.proposed_price);
          return;
        }
        const conversation = data?.conversation;
        if (conversation) {
          setConversationId(conversation.id);
          if (typeof conversation.current_price === "number") {
            setCurrentPrice(conversation.current_price);
          }
        }
      })
      .catch(() => setQuoteMessage("Could not load quotation status."));
  }, []);

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
        setMessages((m) => [...m, { role: "assistant", content: data.reply || "…" }]);
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

  async function copyUpi() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(FAMPAY_UPI);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setQuoteMessage("Clipboard access is unavailable in this browser.");
    }
  }

  async function requestQuoteApproval() {
    if (!conversationId || quoteBusy || quoteStatus === "pending_admin" || quoteStatus === "approved")
      return;
    setQuoteBusy(true);
    setQuoteMessage("");
    try {
      const response = await fetch("/api/ai/quote/accept", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setQuoteMessage(
          data.error === "quote_already_submitted"
            ? "A quotation request already exists for this conversation."
            : "Could not submit the quotation. Please try again."
        );
        return;
      }
      setQuoteStatus("pending_admin");
      setQuoteMessage(data.message || "Quotation sent for admin approval.");
    } catch {
      setQuoteMessage("Could not reach the server. Please try again.");
    } finally {
      setQuoteBusy(false);
    }
  }

  const waMsg = encodeURIComponent(
    `Hi MAXWEB, I am a client (${userEmail}) and need help with my website project.`
  );

  const topNav = (
    <div
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "14px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: dash.teal,
            boxShadow: "0 0 12px rgba(47,181,174,0.7)",
          }}
        />
        <strong style={{ letterSpacing: 1.5, fontSize: 13 }}>MAXWEB</strong>
        <span style={{ color: dash.mutedColor, fontSize: 12 }}>Client portal</span>
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <a href="/" style={{ color: dash.text, textDecoration: "none", fontSize: 14 }}>
          Website
        </a>
        <a href="/#demos" style={{ color: dash.text, textDecoration: "none", fontSize: 14 }}>
          Demos
        </a>
        <button
          type="button"
          onClick={async () => {
            const response = await fetch("/api/auth/sign-out", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!response.ok) return;
            window.location.replace("/#login");
          }}
          style={{ ...dash.ghostBtn, padding: "8px 14px", fontSize: 13 }}
        >
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <DashboardShell topNav={topNav}>
      <div style={{ padding: "28px 20px 88px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          {/* Hero */}
          <section
            style={{
              ...dash.card,
              marginBottom: 22,
              padding: "28px 26px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                right: -40,
                top: -40,
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(47,181,174,0.22), transparent 70%)",
              }}
            />
            <p style={dash.label}>Welcome back</p>
            <h1 style={dash.h1}>
              {userName ? `Hello, ${userName}` : "Your MAXWEB space"}
            </h1>
            <p style={{ ...dash.muted, margin: "12px 0 0", maxWidth: 520 }}>
              Plan your website with clear steps, live demos, and direct founder access —
              same look and feel as the MAXWEB homepage.
            </p>
            <p style={{ color: dash.mutedColor, fontSize: 13, margin: "10px 0 0" }}>
              {userEmail}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <a href="#consultant" style={{ ...dash.accentBtn, textDecoration: "none" }}>
                Start planning
              </a>
              <a href="/#demos" style={{ ...dash.ghostBtn, textDecoration: "none" }}>
                Browse demos
              </a>
            </div>
          </section>

          {/* Attractiveness cards */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 22,
            }}
          >
            {HIGHLIGHTS.map((item) => (
              <a
                key={item.title}
                href={item.href}
                style={{
                  ...dash.cardSoft,
                  textDecoration: "none",
                  color: dash.text,
                  transition: "transform 0.15s ease",
                }}
              >
                <strong style={{ display: "block", fontSize: 16, marginBottom: 6 }}>
                  {item.title}
                </strong>
                <span style={{ color: dash.mutedColor, fontSize: 13, lineHeight: 1.45 }}>
                  {item.text}
                </span>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 12,
                    color: dash.teal,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {item.cta} →
                </span>
              </a>
            ))}
          </section>

          {/* Journey */}
          <section style={{ ...dash.card, marginBottom: 22 }}>
            <p style={dash.label}>Your project path</p>
            <h2 style={{ fontSize: 22, margin: "8px 0 16px", fontWeight: 600 }}>
              Simple, transparent delivery
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {JOURNEY.map((j) => (
                <div key={j.step} style={dash.cardSoft}>
                  <span style={{ color: dash.gold, fontWeight: 700, fontSize: 13 }}>
                    {j.step}
                  </span>
                  <strong style={{ display: "block", margin: "6px 0 4px", fontSize: 15 }}>
                    {j.title}
                  </strong>
                  <p style={{ ...dash.muted, margin: 0, fontSize: 13 }}>{j.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Consultant (kept, visually refined) */}
          <section id="consultant" style={{ ...dash.card, marginBottom: 22 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div>
                <p style={dash.label}>Planning desk</p>
                <h2 style={{ fontSize: 20, margin: "6px 0 0" }}>Website consultant</h2>
              </div>
              <div
                style={{
                  border: "1px solid rgba(210,154,104,0.35)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  color: dash.gold,
                  fontSize: 13,
                  fontWeight: 600,
                  background: "rgba(10,33,71,0.5)",
                }}
              >
                {agreedPrice
                  ? `Agreed ₹${agreedPrice.toLocaleString("en-IN")}`
                  : `Discussing ₹${currentPrice.toLocaleString("en-IN")} · floor ₹7,000`}
              </div>
            </div>

            <div
              style={{
                height: 360,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 14,
                padding: 12,
                borderRadius: 14,
                background: "rgba(10, 33, 71, 0.45)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    background:
                      m.role === "user"
                        ? "linear-gradient(135deg, #1b4a86, #163d70)"
                        : "rgba(255,255,255,0.04)",
                    border:
                      m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius:
                      m.role === "user"
                        ? "16px 16px 4px 16px"
                        : "16px 16px 16px 4px",
                    padding: "11px 14px",
                    maxWidth: "88%",
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              ))}
              {busy ? (
                <div
                  style={{
                    alignSelf: "flex-start",
                    color: dash.mutedColor,
                    fontStyle: "italic",
                    fontSize: 13,
                    padding: "4px 8px",
                  }}
                >
                  Thinking…
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {showChips && !busy ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" style={dash.chip} onClick={() => sendText(s)}>
                    {s}
                  </button>
                ))}
              </div>
            ) : null}

            <form
              style={{ display: "flex", gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                sendText(input);
              }}
            >
              <input
                style={{
                  flex: 1,
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 12,
                  padding: "13px 14px",
                  background: "rgba(255,255,255,0.06)",
                  color: dash.text,
                  fontSize: 14,
                  outline: "none",
                }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe the website you need…"
                disabled={busy}
                aria-label="Message to consultant"
              />
              <button type="submit" style={busy ? dash.ghostBtn : dash.accentBtn} disabled={busy}>
                {busy ? "…" : "Send"}
              </button>
            </form>
          </section>

          {/* Human help */}
          <section id="human-help" style={{ ...dash.card, marginBottom: 22 }}>
            <p style={dash.label}>Founders on call</p>
            <h2 style={{ fontSize: 20, margin: "6px 0 8px" }}>Talk to a human</h2>
            <p style={{ ...dash.muted, marginTop: 0 }}>
              Same numbers as the homepage — WhatsApp or call directly.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              {[
                {
                  label: "WhatsApp",
                  sub: "+91 81062 57124",
                  href: `https://wa.me/${WA_PRIMARY}?text=${waMsg}`,
                },
                {
                  label: "WhatsApp",
                  sub: "+91 89789 57342",
                  href: `https://wa.me/${WA_SECONDARY}?text=${waMsg}`,
                },
                {
                  label: "Call",
                  sub: "+91 81062 57124",
                  href: `tel:+${WA_PRIMARY}`,
                },
              ].map((c) => (
                <a
                  key={c.href + c.label}
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  style={{
                    ...dash.cardSoft,
                    textDecoration: "none",
                    color: dash.text,
                    textAlign: "center",
                    fontWeight: 600,
                  }}
                >
                  {c.label}
                  <span
                    style={{
                      display: "block",
                      fontWeight: 400,
                      fontSize: 12,
                      color: dash.mutedColor,
                      marginTop: 4,
                    }}
                  >
                    {c.sub}
                  </span>
                </a>
              ))}
            </div>
          </section>

          {/* Quote */}
          <section style={dash.card}>
            <p style={dash.label}>Quotation</p>
            <h2 style={{ fontSize: 20, margin: "6px 0 8px" }}>Approval & payment</h2>
            {quoteStatus === "approved" && agreedPrice ? (
              <>
                <p style={{ color: dash.teal, fontSize: 14, marginTop: 0 }}>
                  Admin approved ₹{agreedPrice.toLocaleString("en-IN")}. Payment is enabled.
                </p>
                <div
                  style={{
                    ...dash.cardSoft,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 12, color: dash.mutedColor }}>FamPay UPI</p>
                    <code style={{ fontSize: 16 }}>{FAMPAY_UPI}</code>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={copyUpi} style={dash.ghostBtn}>
                      {copied ? "Copied" : "Copy ID"}
                    </button>
                    <a
                      href={`upi://pay?pa=${encodeURIComponent(FAMPAY_UPI)}&pn=MAXWEB&cu=INR&am=${agreedPrice}`}
                      style={{ ...dash.accentBtn, textDecoration: "none" }}
                    >
                      Pay ₹{agreedPrice.toLocaleString("en-IN")}
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p style={{ ...dash.muted, marginTop: 0 }}>
                  Payment stays locked until a MAXWEB admin approves your quotation.
                </p>
                {quoteStatus === "pending_admin" ? (
                  <p style={{ color: dash.gold, fontSize: 14 }}>
                    Quotation submitted. Waiting for admin approval.
                  </p>
                ) : conversationId ? (
                  <button
                    type="button"
                    onClick={requestQuoteApproval}
                    disabled={quoteBusy}
                    style={quoteBusy ? dash.ghostBtn : dash.accentBtn}
                  >
                    {quoteBusy
                      ? "Submitting…"
                      : `Request approval for ₹${currentPrice.toLocaleString("en-IN")}`}
                  </button>
                ) : (
                  <p style={{ ...dash.muted, fontSize: 13 }}>
                    Start a planning chat above to prepare a quotation.
                  </p>
                )}
              </>
            )}
            {quoteMessage ? (
              <p role="status" style={{ color: dash.mutedColor, fontSize: 13 }}>
                {quoteMessage}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
