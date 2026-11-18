"use client";

import { useState, useRef, useEffect } from "react";
import DashboardShell, { dash } from "@/app/components/dashboard-shell";
import AccountProfile from "@/app/components/account-profile";
import InterviewWizard from "./interview-wizard";

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
  if (code === "ai_not_configured") return "MAXWEB AI is not configured yet. Contact admin on WhatsApp.";
  if (code === "gemini_auth_failed") return "AI authentication failed. You can still reach us on WhatsApp.";
  if (code === "provider_rate_limit") return "The assistant is busy. Please try again shortly.";
  if (code === "provider_timeout" || code === "provider_unavailable" || code === "providers_unavailable") {
    return "The assistant is temporarily unavailable. Try again or use WhatsApp.";
  }
  return data?.message || "Something went wrong. Please try again or use WhatsApp.";
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
        "Hi! I’m MAXWEB’s consultant. Complete the short intake below (or chat directly). Your full transcript is visible to our team — we do not rely on AI summaries.",
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
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");
  const [demoRequested, setDemoRequested] = useState(false);
  const [intakeDone, setIntakeDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    fetch("/api/ai/quote/status", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const quote = data?.quote;
        if (quote) {
          setQuoteStatus(quote.status);
          setConversationId(quote.conversation_id);
          setCurrentPrice(quote.proposed_price);
          if (quote.status === "approved") setAgreedPrice(quote.proposed_price);
          setIntakeDone(true);
          return;
        }
        const conversation = data?.conversation;
        if (conversation) {
          setConversationId(conversation.id);
          if (typeof conversation.current_price === "number") setCurrentPrice(conversation.current_price);
          setIntakeDone(true);
        }
      })
      .catch(() => undefined);
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
        { role: "assistant", content: "Could not reach the server. Check your connection." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function requestDemo() {
    if (demoBusy || demoRequested) return;
    setDemoBusy(true);
    setDemoMessage("");
    try {
      const response = await fetch("/api/client/demo-request", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          note: "Client requested a live demo of MAXWEB sample websites.",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDemoMessage("Could not send the demo request.");
        return;
      }
      if (data.conversationId) setConversationId(data.conversationId);
      setDemoRequested(true);
      setDemoMessage(data.message || "Demo requested. Our team can see your full chat.");
    } catch {
      setDemoMessage("Could not reach the server.");
    } finally {
      setDemoBusy(false);
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
        setQuoteMessage("Could not submit the quotation.");
        return;
      }
      setQuoteStatus("pending_admin");
      setQuoteMessage(data.message || "Quotation sent for admin approval.");
    } catch {
      setQuoteMessage("Could not reach the server.");
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
            await fetch("/api/auth/sign-out", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            window.location.replace("/");
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
      <div style={{ padding: "28px 20px 116px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <section style={{ ...dash.card, marginBottom: 22, padding: "28px 26px" }}>
            <p style={dash.label}>Welcome back</p>
            <h1 style={dash.h1}>{userName ? `Hello, ${userName}` : "Your MAXWEB space"}</h1>
            <p style={{ ...dash.muted, margin: "12px 0 0", maxWidth: 560 }}>
              Multi-language intake + Gemini chat. Full transcript goes to the team — no AI summary
              reports.
            </p>
            <p style={{ color: dash.mutedColor, fontSize: 13, margin: "10px 0 0" }}>{userEmail}</p>
          </section>

          {!intakeDone ? (
            <InterviewWizard
              onComplete={({ conversationId: id, reply, currentPrice: price, demoRequested: demo }) => {
                setConversationId(id);
                setCurrentPrice(price);
                if (demo) setDemoRequested(true);
                setIntakeDone(true);
                setShowChips(false);
                setMessages((m) => [
                  ...m,
                  { role: "user", content: "[STRUCTURED INTAKE submitted]" },
                  { role: "assistant", content: reply },
                ]);
              }}
            />
          ) : null}

          <section id="consultant" style={{ ...dash.card, marginBottom: 22 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div>
                <p style={dash.label}>AI CONSULTANT · GEMINI</p>
                <h2 style={{ fontSize: 20, margin: "6px 0 0" }}>Chat</h2>
              </div>
              <div
                style={{
                  border: "1px solid rgba(210,154,104,0.35)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  color: dash.gold,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {agreedPrice
                  ? `Agreed ₹${agreedPrice.toLocaleString("en-IN")}`
                  : `Discussing ₹${currentPrice.toLocaleString("en-IN")} · floor ₹7,000`}
              </div>
            </div>

            <div
              style={{
                height: 340,
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
                    border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
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
                <div style={{ color: dash.mutedColor, fontStyle: "italic", fontSize: 13 }}>Thinking…</div>
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
                }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message the consultant…"
                disabled={busy}
              />
              <button type="submit" style={busy ? dash.ghostBtn : dash.accentBtn} disabled={busy}>
                {busy ? "…" : "Send"}
              </button>
            </form>
          </section>

          <section id="request-demo" style={{ ...dash.card, marginBottom: 22 }}>
            <p style={dash.label}>Live walkthrough</p>
            <h2 style={{ fontSize: 20, margin: "6px 0 8px" }}>Request a demo</h2>
            <p style={{ ...dash.muted, marginTop: 0 }}>
              Your entire chat is visible to admins when you request a demo.
            </p>
            <button
              type="button"
              onClick={requestDemo}
              disabled={demoBusy || demoRequested}
              style={demoBusy || demoRequested ? dash.ghostBtn : dash.accentBtn}
            >
              {demoRequested ? "Demo requested" : demoBusy ? "Sending…" : "Request demo"}
            </button>
            {demoMessage ? (
              <p style={{ color: dash.teal, fontSize: 13, marginTop: 12 }}>{demoMessage}</p>
            ) : null}
          </section>

          <section id="human-help" style={{ ...dash.card, marginBottom: 22 }}>
            <p style={dash.label}>Founders</p>
            <h2 style={{ fontSize: 20, margin: "6px 0 8px" }}>Talk to a human</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <a
                href={`https://wa.me/${WA_PRIMARY}?text=${waMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...dash.cardSoft, textDecoration: "none", color: dash.text }}
              >
                WhatsApp +91 81062 57124
              </a>
              <a
                href={`https://wa.me/${WA_SECONDARY}?text=${waMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...dash.cardSoft, textDecoration: "none", color: dash.text }}
              >
                WhatsApp +91 89789 57342
              </a>
            </div>
          </section>

          <section style={dash.card}>
            <p style={dash.label}>Quotation</p>
            <h2 style={{ fontSize: 20, margin: "6px 0 8px" }}>Approval & payment</h2>
            {quoteStatus === "approved" && agreedPrice ? (
              <>
                <p style={{ color: dash.teal, fontSize: 14 }}>Approved ₹{agreedPrice.toLocaleString("en-IN")}</p>
                <button type="button" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(FAMPAY_UPI);
                    setCopied(true);
                  } catch {
                    setQuoteMessage("Clipboard unavailable");
                  }
                }} style={dash.ghostBtn}>
                  {copied ? "Copied UPI" : `Copy ${FAMPAY_UPI}`}
                </button>
              </>
            ) : (
              <>
                <p style={{ ...dash.muted, marginTop: 0 }}>
                  Payment unlocks after admin approval.
                </p>
                {quoteStatus === "pending_admin" ? (
                  <p style={{ color: dash.gold }}>Waiting for admin approval.</p>
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
                  <p style={{ ...dash.muted, fontSize: 13 }}>Complete intake or chat first.</p>
                )}
              </>
            )}
            {quoteMessage ? <p style={{ color: dash.mutedColor, fontSize: 13 }}>{quoteMessage}</p> : null}
          </section>
        </div>
      </div>
      <AccountProfile email={userEmail} name={userName} />
    </DashboardShell>
  );
}
