import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SummaryJob = {
  conversation_id: string;
  attempts: number;
  next_attempt_at: string;
  completed_at: string | null;
  last_error: string | null;
  lease_until: string | null;
  updated_at: string;
};

const PANEL = {
  border: "1px solid #ffffff1f",
  borderRadius: 14,
  padding: 18,
  background: "linear-gradient(160deg, #143a72, #0e2d5c)",
} as const;

function getJobState(job: SummaryJob, now: number) {
  if (job.completed_at) return "Completed";
  if (job.lease_until && new Date(job.lease_until).getTime() > now) return "Processing";
  if (job.last_error) return "Failed / retrying";
  return "Pending";
}

export default async function AdminAISummaryMonitor() {
  let jobs: SummaryJob[] = [];
  let conversationsById = new Map<string, { title: string | null; summary: string | null; user_id: string }>();
  let unavailable = false;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("ai_summary_jobs")
      .select("conversation_id, attempts, next_attempt_at, completed_at, last_error, lease_until, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    jobs = (data || []) as SummaryJob[];

    if (jobs.length) {
      const { data: conversations, error: conversationError } = await admin
        .from("ai_conversations")
        .select("id, title, summary, user_id")
        .in("id", jobs.map((job) => job.conversation_id));

      if (conversationError) throw conversationError;
      conversationsById = new Map(
        (conversations || []).map((conversation) => [
          conversation.id,
          { title: conversation.title, summary: conversation.summary, user_id: conversation.user_id },
        ])
      );
    }
  } catch (error) {
    unavailable = true;
    console.error("admin AI summary monitor unavailable", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }

  const now = Date.now();
  const counts = {
    Pending: 0,
    Processing: 0,
    Completed: 0,
    "Failed / retrying": 0,
  };
  for (const job of jobs) counts[getJobState(job, now) as keyof typeof counts] += 1;

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 6 }}>AI conversation summary monitor</h2>
          <p style={{ color: "#9fb3cf", fontSize: 13, marginTop: 0 }}>
            Latest 50 summary jobs. Queue activity is shown here; it is not a record of cron invocation time.
          </p>
        </div>
        <span style={{ color: "#9fb3cf", fontSize: 12 }}>Daily schedule: 05:30 IST</span>
      </div>

      {unavailable ? (
        <div style={{ ...PANEL, color: "#ffb6a9" }}>
          Summary job data is unavailable. Check the service-role environment configuration and database migration.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
            {Object.entries(counts).map(([label, value]) => (
              <div key={label} style={{ ...PANEL, padding: 14 }}>
                <p style={{ color: "#9fb3cf", fontSize: 11, margin: 0, letterSpacing: 1 }}>{label.toUpperCase()}</p>
                <p style={{ fontSize: 23, fontWeight: 700, margin: "7px 0 0" }}>{value}</p>
              </div>
            ))}
          </div>

          {jobs.length === 0 ? (
            <div style={{ ...PANEL, color: "#9fb3cf" }}>No summary jobs are recorded yet. Jobs appear when the scheduler discovers conversations that need summaries.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {jobs.map((job) => {
                const conversation = conversationsById.get(job.conversation_id);
                const state = getJobState(job, now);
                return (
                  <article key={job.conversation_id} style={{ ...PANEL, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <strong>{conversation?.title || "Customer AI consultation"}</strong>
                        <p style={{ color: "#9fb3cf", fontSize: 11, margin: "5px 0" }}>
                          Conversation: {job.conversation_id} · Customer: {conversation?.user_id || "Unavailable"}
                        </p>
                      </div>
                      <strong style={{ color: state === "Completed" ? "#55d6ad" : state === "Failed / retrying" ? "#ffbd75" : "#9fb3cf" }}>
                        {state}
                      </strong>
                    </div>
                    {conversation?.summary ? (
                      <p style={{ color: "#d4dfef", fontSize: 13, lineHeight: 1.5, margin: "8px 0" }}>{conversation.summary}</p>
                    ) : (
                      <p style={{ color: "#9fb3cf", fontSize: 13, fontStyle: "italic", margin: "8px 0" }}>No generated summary available yet.</p>
                    )}
                    <p style={{ color: "#9fb3cf", fontSize: 12, margin: "8px 0 0" }}>
                      Attempts: {job.attempts} · Last queue update: {new Date(job.updated_at).toLocaleString("en-IN")}
                      {state === "Failed / retrying" ? ` · Next retry: ${new Date(job.next_attempt_at).toLocaleString("en-IN")}` : ""}
                    </p>
                    {job.last_error ? (
                      <p style={{ color: "#ffb6a9", fontSize: 12, margin: "7px 0 0" }}>Last error: {job.last_error}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
