"use client";

import { useState, useRef, useEffect } from "react";
import DashboardShell, { dash } from "@/app/components/dashboard-shell";
import InterviewWizard from "./interview-wizard";

type Msg = { role: "user" | "assistant"; content: string; at?: number };

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

function avatarKey(email: string) {
  return `maxweb-avatar:${email.toLowerCase()}`;
}

function initials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "MW";
  }
  return (email?.[0] || "M").toUpperCase();
}

function friendlyAiError(data: { error?: string; message?: string } | null): string {
  const code = data?.error || "";
  if (code === "ai_not_configured") return "MAXWEB AI is not configured yet. Contact admin on WhatsApp.";
  if (code === "gemini_auth_failed") return "AI authentication failed. You can still reach us on WhatsApp.";
  if (code === "provider_rate_limit") return "The assistant is busy. Please try again shortly.";
  if (code === "provider_timeout" || code === "provider_unavailable" || code === "providers_unavailable") {
    return "The assistant is temporarily unavailable. Try again or use WhatsApp.";
  }
  if (code === "unauthenticated") return "Session expired. Please log in again.";
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
      at: Date.now(),
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(avatarKey(userEmail));
      if (saved) setAvatarUrl(saved);
    } catch {
      /* ignore */
    }
  }, [userEmail]);

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
          if (conversation.demo_requested_at) setDemoRequested(true);
          setIntakeDone(true);
        }
      })
      .catch(() => undefined);
  }, []);

  function onPickAvatar(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 1_200_000) {
      setDemoMessage("Please choose an image under 1.2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      setAvatarUrl(dataUrl);
      try {
        localStorage.setItem(avatarKey(userEmail), dataUrl);
      } catch {
        /* storage full */
      }
    };
    reader.readAsDataURL(file);
  }

  async function sendText(text: string) {
    const cleaned = text.trim();
    if (!cleaned || busy) return;
    setShowChips(false);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: cleaned, at: Date.now() }]);
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
        setMessages((m) => [...m, { role: "assistant", content: friendlyAiError(data), at: Date.now() }]);
      } else {
        if (typeof data.currentPrice === "number") setCurrentPrice(data.currentPrice);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.reply || "…", at: Date.now() },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Could not reach the server. Check your connection.", at: Date.now() },
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
        setDemoMessage(
          data.error === "unauthenticated"
            ? "Please log in again, then request the demo."
            : "Could not send the demo request. Try again."
        );
        return;
      }
      if (data.conversationId) setConversationId(data.conversationId);
      setDemoRequested(true);
      setDemoMessage(data.message || "Demo requested. Our team can see your full chat.");
      setMessages((m) => [
        ...m,
        {
          role: "user",
          content: "[DEMO REQUEST] Client asked for a live demo.",
          at: Date.now(),
        },
      ]);
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
        <a href="/#work" style={{ color: dash.text, textDecoration: "none", fontSize: 14 }}>
          Demos
        </a>
        <button
          type="button"
          onClick={async () => {
            const res = await fetch("/api/auth/sign-out", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            const data = await res.json().catch(() => ({}));
            if (data.redirectTo) {
              window.location.assign(data.redirectTo);
              return;
            }
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
          <section style={{ ...dash.card, marginBottom: 22, padding: "24px 26px" }}>
            <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="Change profile picture"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  border: "2px solid rgba(47,181,174,0.55)",
                  overflow: "hidden",
                  padding: 0,
                  cursor: "pointer",
                  background: "linear-gradient(145deg,#1b4a86,#0e2d5c)",
                  color: "#eaf1fb",
                  fontWeight: 700,
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  initials(userName, userEmail)
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onPickAvatar(e.target.files?.[0] || null)}
              />
              <div style={{ minWidth: 200, flex: 1 }}>
                <p style={dash.label}>Your account</p>
                <h1 style={{ ...dash.h1, fontSize: 28, margin: "6px 0 0" }}>
                  {userName ? userName : "MAXWEB client"}
                </h1>
                <p style={{ color: dash.teal, fontSize: 15, margin: "8px 0 0", fontWeight: 600 }}>
                  {userEmail}
                </p>
                <p style={{ color: dash.mutedColor, fontSize: 13, margin: "8px 0 0" }}>
                  Tap the photo to change your profile picture. Email comes from your login (Gmail
                  or other).
                </p>
              </div>
            </div>
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
                  { role: "user", content: "[STRUCTURED INTAKE submitted]", at: Date.now() },
                  { role: "assistant", content: reply, at: Date.now() },
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
                <p style={dash.label}>Gemini consultant</p>
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
                height: 380,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                marginBottom: 14,
                padding: "14px 12px",
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
                    maxWidth: "86%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    alignItems: m.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <span style={{ fontSize: 11, color: dash.mutedColor, letterSpacing: 0.3 }}>
                    {m.role === "user" ? "You" : "MAXWEB"}
                    {m.at
                      ? ` · ${new Date(m.at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : ""}
                  </span>
                  <div
                    style={{
                      background:
                        m.role === "user"
                          ? "linear-gradient(135deg, #1b4a86, #163d70)"
                          : "rgba(255,255,255,0.05)",
                      border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      padding: "12px 14px",
                      fontSize: 14,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.content}
                  </div>
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
                <p style={{ color: dash.teal, fontSize: 14 }}>
                  Approved ₹{agreedPrice.toLocaleString("en-IN")}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(FAMPAY_UPI);
                      setCopied(true);
                    } catch {
                      setQuoteMessage("Clipboard unavailable");
                    }
                  }}
                  style={dash.ghostBtn}
                >
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
    </DashboardShell>
  );
}
