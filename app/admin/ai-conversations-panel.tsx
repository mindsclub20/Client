import { createSupabaseServerClient } from "@/lib/supabase/server";

const PANEL = {
  border: "1px solid #ffffff1f",
  borderRadius: 14,
  padding: 18,
  background: "linear-gradient(160deg, #143a72, #0e2d5c)",
} as const;

type ConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  status: string;
  website_type: string | null;
  starting_price: number | null;
  current_price: number | null;
  agreed_price: number | null;
  demo_requested_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};

function formatInr(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default async function AdminAIConversationsPanel({
  approvedPriceByConversation,
}: {
  approvedPriceByConversation: Map<string, number>;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: conversations, error } = await supabase
    .from("ai_conversations")
    .select(
      "id, user_id, title, status, website_type, starting_price, current_price, agreed_price, demo_requested_at, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("admin conversations load failed", { code: error.code });
    return (
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 14 }}>Client chats</h2>
        <div style={{ ...PANEL, color: "#ffb6a9" }}>
          Could not load conversations. Check RLS policies for administrators.
        </div>
      </section>
    );
  }

  const list = (conversations || []) as ConversationRow[];
  const ids = list.map((c) => c.id);

  const messagesByConversation = new Map<string, MessageRow[]>();

  if (ids.length) {
    const { data: messages, error: messageError } = await supabase
      .from("ai_messages")
      .select("conversation_id, role, content, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: true })
      .limit(1200);

    if (messageError) {
      console.error("admin messages load failed", { code: messageError.code });
    } else {
      for (const message of (messages || []) as MessageRow[]) {
        const bucket = messagesByConversation.get(message.conversation_id) || [];
        bucket.push(message);
        messagesByConversation.set(message.conversation_id, bucket);
      }
    }
  }

  const demoCount = list.filter((c) => c.demo_requested_at).length;
  const activeCount = list.filter((c) => c.status === "active").length;
  const prices = list
    .map((c) => Number(c.current_price))
    .filter((n) => Number.isFinite(n) && n >= 7000 && n <= 15000);
  const avgCurrent =
    prices.length > 0
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      : null;

  return (
    <section style={{ marginTop: 28 }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>Client chats (full transcript)</h2>
        <p style={{ color: "#9fb3cf", fontSize: 13, marginTop: 0 }}>
          Entire conversation is shown here — no AI summaries. Demo requests are highlighted.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        {[
          { label: "Chats", value: String(list.length) },
          { label: "Active", value: String(activeCount) },
          { label: "Demo requests", value: String(demoCount) },
          {
            label: "Avg current price",
            value: avgCurrent ? formatInr(avgCurrent) : "—",
          },
        ].map((stat) => (
          <div key={stat.label} style={{ ...PANEL, padding: 14 }}>
            <p style={{ color: "#9fb3cf", fontSize: 11, margin: 0, letterSpacing: 1 }}>
              {stat.label.toUpperCase()}
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, margin: "7px 0 0" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <div
          style={{
            ...PANEL,
            borderStyle: "dashed",
            color: "#9fb3cf",
            textAlign: "center",
            padding: 28,
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 16, color: "#eaf1fb" }}>No client chats yet</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            When clients use <strong>/client</strong>, the full message thread appears here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {list.map((c) => {
            const approved = approvedPriceByConversation.get(c.id);
            const thread = messagesByConversation.get(c.id) || [];

            return (
              <article key={c.id} style={{ ...PANEL, padding: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 15 }}>
                      {c.website_type
                        ? c.website_type.charAt(0).toUpperCase() + c.website_type.slice(1)
                        : c.title || "Consultation"}
                    </strong>
                    <span
                      style={{
                        marginLeft: 10,
                        fontSize: 12,
                        color: c.status === "active" ? "#9fb3cf" : "#55d6ad",
                      }}
                    >
                      {c.status}
                    </span>
                    {c.demo_requested_at ? (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 12,
                          color: "#d29a68",
                          fontWeight: 700,
                        }}
                      >
                        Demo requested
                      </span>
                    ) : null}
                    <p style={{ color: "#9fb3cf", fontSize: 11, margin: "6px 0 0" }}>
                      Customer: {c.user_id} · {thread.length} messages
                    </p>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 14 }}>
                    <div style={{ color: "#d29a68", fontWeight: 700 }}>
                      {approved != null
                        ? `Approved ${formatInr(approved)}`
                        : `Current ${formatInr(c.current_price ?? 15000)}`}
                    </div>
                    <div style={{ color: "#9fb3cf", fontSize: 12, marginTop: 4 }}>
                      Start {formatInr(c.starting_price ?? 15000)}
                    </div>
                  </div>
                </div>

                {c.demo_requested_at ? (
                  <p style={{ color: "#d29a68", fontSize: 13, margin: "10px 0 0" }}>
                    Demo requested {" "}
                    {new Date(c.demo_requested_at).toLocaleString("en-IN")}
                  </p>
                ) : null}

                <div
                  style={{
                    marginTop: 12,
                    maxHeight: 320,
                    overflowY: "auto",
                    borderRadius: 12,
                    border: "1px solid #ffffff14",
                    background: "#0a2147",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {thread.length === 0 ? (
                    <p style={{ color: "#9fb3cf", fontSize: 13, margin: 0, fontStyle: "italic" }}>
                      No messages in this thread yet.
                    </p>
                  ) : (
                    thread.map((m, index) => {
                      const role = String(m.role).toLowerCase();
                      const isUser = role === "user" || role === "customer";
                      return (
                        <div
                          key={`${c.id}-${index}-${m.created_at}`}
                          style={{
                            alignSelf: isUser ? "flex-end" : "flex-start",
                            maxWidth: "92%",
                            borderRadius: isUser
                              ? "12px 12px 4px 12px"
                              : "12px 12px 12px 4px",
                            padding: "8px 12px",
                            background: isUser ? "#1b4a86" : "#ffffff0a",
                            border: isUser ? "none" : "1px solid #ffffff14",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: 11,
                              color: "#9fb3cf",
                              letterSpacing: 0.4,
                            }}
                          >
                            {isUser ? "Client" : role === "assistant" ? "Assistant" : role} ·{" "}
                            {new Date(m.created_at).toLocaleString("en-IN")}
                          </p>
                          <p
                            style={{
                              margin: "4px 0 0",
                              fontSize: 13,
                              lineHeight: 1.45,
                              whiteSpace: "pre-wrap",
                              color: "#eaf1fb",
                            }}
                          >
                            {m.content}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                <p style={{ color: "#9fb3cf", fontSize: 12, margin: "8px 0 0" }}>
                  Updated {new Date(c.updated_at).toLocaleString("en-IN")}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
