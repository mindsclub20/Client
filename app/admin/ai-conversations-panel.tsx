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
  summary: string | null;
  summary_generated_at?: string | null;
  created_at: string;
  updated_at: string;
};

function formatInr(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function summaryState(c: ConversationRow) {
  if (c.summary && c.summary.trim()) {
    if (
      c.summary_generated_at &&
      new Date(c.updated_at).getTime() > new Date(c.summary_generated_at).getTime()
    ) {
      return { label: "Summary stale", color: "#ffbd75" };
    }
    return { label: "Summarized", color: "#55d6ad" };
  }
  return { label: "Needs summary", color: "#9fb3cf" };
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
      "id, user_id, title, status, website_type, starting_price, current_price, agreed_price, summary, summary_generated_at, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("admin conversations load failed", { code: error.code });
    return (
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 14 }}>AI client interactions & bargains</h2>
        <div style={{ ...PANEL, color: "#ffb6a9" }}>
          Could not load AI conversations. Check RLS policies for administrators.
        </div>
      </section>
    );
  }

  const list = (conversations || []) as ConversationRow[];
  const ids = list.map((c) => c.id);

  const messageCountById = new Map<string, number>();
  const lastUserMessageById = new Map<string, string>();
  const lastAssistantMessageById = new Map<string, string>();

  if (ids.length) {
    const { data: messages, error: messageError } = await supabase
      .from("ai_messages")
      .select("conversation_id, role, content, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(400);

    if (messageError) {
      console.error("admin messages load failed", { code: messageError.code });
    } else {
      for (const message of messages || []) {
        const id = message.conversation_id as string;
        messageCountById.set(id, (messageCountById.get(id) || 0) + 1);
        const role = String(message.role).toLowerCase();
        const content = String(message.content || "").trim();
        if (!content) continue;
        if ((role === "user" || role === "customer") && !lastUserMessageById.has(id)) {
          lastUserMessageById.set(id, content.slice(0, 280));
        }
        if (role === "assistant" && !lastAssistantMessageById.has(id)) {
          lastAssistantMessageById.set(id, content.slice(0, 280));
        }
      }
    }
  }

  const needsSummary = list.filter((c) => !c.summary || !String(c.summary).trim()).length;
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "baseline",
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 6 }}>AI client interactions & bargains</h2>
          <p style={{ color: "#9fb3cf", fontSize: 13, marginTop: 0 }}>
            Live consultations from /client. Price floor ₹7,000 · start ₹15,000 · Gemini only.
          </p>
        </div>
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
          { label: "Listed chats", value: String(list.length) },
          { label: "Active", value: String(activeCount) },
          { label: "Need summary", value: String(needsSummary) },
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
          <p style={{ margin: "0 0 8px", fontSize: 16, color: "#eaf1fb" }}>
            No AI conversations yet
          </p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            When clients use the AI consultant on <strong>/client</strong>, website type,
            bargain price, and transcripts appear here for review and quote approval.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((c) => {
            const state = summaryState(c);
            const approved = approvedPriceByConversation.get(c.id);
            const msgCount = messageCountById.get(c.id) || 0;
            const lastUser = lastUserMessageById.get(c.id);
            const lastAssistant = lastAssistantMessageById.get(c.id);

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
                    <span
                      style={{
                        marginLeft: 10,
                        fontSize: 12,
                        color: state.color,
                        fontWeight: 600,
                      }}
                    >
                      {state.label}
                    </span>
                    <p style={{ color: "#9fb3cf", fontSize: 11, margin: "6px 0 0" }}>
                      Customer: {c.user_id} · Messages: {msgCount}
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

                {lastUser ? (
                  <p style={{ color: "#eaf1fb", fontSize: 13, lineHeight: 1.45, margin: "10px 0 0" }}>
                    <strong>Customer:</strong> {lastUser}
                  </p>
                ) : null}
                {lastAssistant ? (
                  <p style={{ color: "#d4dfef", fontSize: 13, lineHeight: 1.45, margin: "8px 0 0" }}>
                    <strong>AI:</strong> {lastAssistant}
                  </p>
                ) : null}

                {c.summary ? (
                  <p
                    style={{
                      color: "#9fb3cf",
                      fontSize: 13,
                      margin: "10px 0 0",
                      lineHeight: 1.45,
                      borderTop: "1px solid #ffffff14",
                      paddingTop: 10,
                    }}
                  >
                    <strong style={{ color: "#eaf1fb" }}>Summary:</strong> {c.summary}
                  </p>
                ) : (
                  <p
                    style={{
                      color: "#9fb3cf",
                      fontSize: 13,
                      margin: "10px 0 0",
                      fontStyle: "italic",
                    }}
                  >
                    No AI summary yet — scheduled daily job will generate one when the queue runs.
                  </p>
                )}

                <p style={{ color: "#9fb3cf", fontSize: 12, margin: "8px 0 0" }}>
                  Updated {new Date(c.updated_at).toLocaleString("en-IN")}
                  {c.summary_generated_at
                    ? ` · Summarized ${new Date(c.summary_generated_at).toLocaleString("en-IN")}`
                    : ""}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
