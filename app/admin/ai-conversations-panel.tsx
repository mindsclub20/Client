import { createVerifiedAdminDataClient } from "@/lib/admin-auth";

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
  customer_name: string | null;
  business_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  preferred_language: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};

type AccountGroup = {
  userId: string;
  label: string;
  email: string | null;
  phone: string | null;
  business: string | null;
  conversations: ConversationRow[];
  latestUpdate: number;
  demoCount: number;
  activeCount: number;
  messageCount: number;
};

function formatInr(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function accountLabel(rows: ConversationRow[]): {
  label: string;
  email: string | null;
  phone: string | null;
  business: string | null;
} {
  const named = rows.find((r) => r.customer_name?.trim());
  const emailed = rows.find((r) => r.contact_email?.trim());
  const phoned = rows.find((r) => r.contact_phone?.trim());
  const businessed = rows.find((r) => r.business_name?.trim());
  const email = emailed?.contact_email?.trim() || null;
  const phone = phoned?.contact_phone?.trim() || null;
  const business = businessed?.business_name?.trim() || null;
  const name = named?.customer_name?.trim() || null;
  const label = name || email || business || `Account ${rows[0].user_id.slice(0, 8)}…`;
  return { label, email, phone, business };
}

export default async function AdminAIConversationsPanel({
  approvedPriceByConversation,
}: {
  approvedPriceByConversation: Map<string, number>;
}) {
  let list: ConversationRow[] = [];
  let loadError: string | null = null;
  const messagesByConversation = new Map<string, MessageRow[]>();

  try {
    const supabase = await createVerifiedAdminDataClient();
    const { data: conversations, error } = await supabase
      .from("ai_conversations")
      .select(
        "id, user_id, title, status, website_type, starting_price, current_price, agreed_price, demo_requested_at, customer_name, business_name, contact_email, contact_phone, preferred_language, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(120);

    if (error) {
      console.error("admin conversations load failed", { code: error.code });
      loadError = "Could not load conversations. Check service-role configuration and table access.";
    } else {
      list = (conversations || []) as ConversationRow[];
      const ids = list.map((c) => c.id);
      if (ids.length) {
        const { data: messages, error: messageError } = await supabase
          .from("ai_messages")
          .select("conversation_id, role, content, created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: true })
          .limit(2500);

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
    }
  } catch (error) {
    console.error(
      "admin conversations client failed",
      error instanceof Error ? error.message : "unknown error"
    );
    loadError =
      "Admin data client is not configured. Set SUPABASE_SERVICE_ROLE_KEY for Authgear admin chat access.";
  }

  if (loadError) {
    return (
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 14 }}>Client chats by account</h2>
        <div style={{ ...PANEL, color: "#ffb6a9" }}>{loadError}</div>
      </section>
    );
  }

  const byUser = new Map<string, ConversationRow[]>();
  for (const c of list) {
    const bucket = byUser.get(c.user_id) || [];
    bucket.push(c);
    byUser.set(c.user_id, bucket);
  }

  const accounts: AccountGroup[] = [...byUser.entries()].map(([userId, rows]) => {
    const meta = accountLabel(rows);
    const latestUpdate = Math.max(...rows.map((r) => new Date(r.updated_at).getTime()));
    const messageCount = rows.reduce(
      (sum, r) => sum + (messagesByConversation.get(r.id)?.length || 0),
      0
    );
    return {
      userId,
      label: meta.label,
      email: meta.email,
      phone: meta.phone,
      business: meta.business,
      conversations: rows.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
      latestUpdate,
      demoCount: rows.filter((r) => r.demo_requested_at).length,
      activeCount: rows.filter((r) => r.status === "active").length,
      messageCount,
    };
  });

  accounts.sort((a, b) => b.latestUpdate - a.latestUpdate);

  const demoCount = list.filter((c) => c.demo_requested_at).length;
  const activeCount = list.filter((c) => c.status === "active").length;

  return (
    <section style={{ marginTop: 28 }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>Client chats by account</h2>
        <p style={{ color: "#9fb3cf", fontSize: 13, marginTop: 0 }}>
          Grouped by customer account. Open an account to see every conversation and the full
          transcript — no AI summaries.
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
          { label: "Accounts", value: String(accounts.length) },
          { label: "Chats", value: String(list.length) },
          { label: "Active chats", value: String(activeCount) },
          { label: "Demo requests", value: String(demoCount) },
        ].map((stat) => (
          <div key={stat.label} style={{ ...PANEL, padding: 14 }}>
            <p style={{ color: "#9fb3cf", fontSize: 11, margin: 0, letterSpacing: 1 }}>
              {stat.label.toUpperCase()}
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, margin: "7px 0 0" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {accounts.length === 0 ? (
        <div
          style={{
            ...PANEL,
            borderStyle: "dashed",
            color: "#9fb3cf",
            textAlign: "center",
            padding: 28,
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 16, color: "#eaf1fb" }}>No client accounts yet</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            When clients use <strong>/client</strong>, their chats appear here under their account.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {accounts.map((account) => (
            <details
              key={account.userId}
              open={accounts.length === 1 || account.demoCount > 0}
              style={{ ...PANEL, padding: 0, overflow: "hidden" }}
            >
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  padding: "16px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                  borderBottom: "1px solid #ffffff14",
                }}
              >
                <div>
                  <strong style={{ fontSize: 16 }}>{account.label}</strong>
                  {account.business ? (
                    <span style={{ marginLeft: 8, color: "#9fb3cf", fontSize: 13 }}>
                      · {account.business}
                    </span>
                  ) : null}
                  <p style={{ color: "#9fb3cf", fontSize: 12, margin: "6px 0 0" }}>
                    {account.email || "Email not set in intake"}
                    {account.phone ? ` · ${account.phone}` : ""}
                    {" · "}
                    {account.conversations.length} chat
                    {account.conversations.length === 1 ? "" : "s"}
                    {" · "}
                    {account.messageCount} messages
                  </p>
                  <p style={{ color: "#6f86a8", fontSize: 11, margin: "4px 0 0" }}>
                    Account ID: {account.userId}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {account.demoCount > 0 ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#d29a68",
                        border: "1px solid rgba(210,154,104,0.4)",
                        borderRadius: 999,
                        padding: "4px 10px",
                      }}
                    >
                      {account.demoCount} demo request{account.demoCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  <span
                    style={{
                      fontSize: 12,
                      color: "#9fb3cf",
                      border: "1px solid #ffffff1f",
                      borderRadius: 999,
                      padding: "4px 10px",
                    }}
                  >
                    {account.activeCount} active
                  </span>
                  <span style={{ fontSize: 12, color: "#9fb3cf" }}>
                    Updated {new Date(account.latestUpdate).toLocaleString("en-IN")}
                  </span>
                </div>
              </summary>

              <div
                style={{
                  padding: "14px 18px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {account.conversations.map((c, chatIndex) => {
                  const approved = approvedPriceByConversation.get(c.id);
                  const thread = messagesByConversation.get(c.id) || [];

                  return (
                    <article
                      key={c.id}
                      style={{
                        border: "1px solid #ffffff14",
                        borderRadius: 12,
                        padding: 14,
                        background: "rgba(10, 33, 71, 0.45)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: 14 }}>
                            Chat {chatIndex + 1}
                            {" · "}
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
                          {c.preferred_language ? (
                            <span style={{ marginLeft: 10, fontSize: 12, color: "#9fb3cf" }}>
                              lang: {c.preferred_language}
                            </span>
                          ) : null}
                          <p style={{ color: "#9fb3cf", fontSize: 11, margin: "6px 0 0" }}>
                            {thread.length} messages · chat id {c.id.slice(0, 8)}…
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
                          Demo requested{" "}
                          {new Date(c.demo_requested_at).toLocaleString("en-IN")}
                        </p>
                      ) : null}

                      <div
                        style={{
                          marginTop: 12,
                          maxHeight: 280,
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
                          <p
                            style={{
                              color: "#9fb3cf",
                              fontSize: 13,
                              margin: 0,
                              fontStyle: "italic",
                            }}
                          >
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
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
