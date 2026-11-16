import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { INTERVIEW_STEPS } from "@/lib/consultant/steps";
import { buildRequirementReport, type Answers } from "@/lib/consultant/types";
import { isLangCode, type LangCode } from "@/lib/consultant/languages";
import { completeAI, ProviderError, type ChatMessage } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const language: LangCode = isLangCode(String(body.language || ""))
      ? (body.language as LangCode)
      : "en";
    const answers = (body.answers && typeof body.answers === "object"
      ? body.answers
      : {}) as Answers;
    const askAi = body.askAi !== false;

    const report = buildRequirementReport(INTERVIEW_STEPS, answers, language);
    if (report.missing.length) {
      return NextResponse.json(
        { error: "missing_required", missing: report.missing },
        { status: 400 }
      );
    }

    const websiteType =
      typeof answers.website_type === "string" ? answers.website_type : null;
    const budget =
      typeof answers.budget_signal === "string" ? answers.budget_signal : "unsure";
    let currentPrice = 15000;
    if (budget === "10000") currentPrice = 10000;
    if (budget === "7000") currentPrice = 7000;

    const customerName =
      typeof answers.customer_name === "string" ? answers.customer_name.trim() : null;
    const businessName =
      typeof answers.business_name === "string" ? answers.business_name.trim() : null;
    const phone =
      typeof answers.contact_phone === "string" ? answers.contact_phone.trim() : null;

    const demoYes = answers.demo_interest === "yes";

    const { data: created, error: createError } = await supabase
      .from("ai_conversations")
      .insert({
        user_id: user.id,
        title: businessName || customerName || "Website consultation",
        status: "active",
        starting_price: 15000,
        current_price: currentPrice,
        minimum_price: 7000,
        website_type: websiteType,
        preferred_language: language,
        customer_name: customerName,
        business_name: businessName,
        contact_email: user.email || null,
        contact_phone: phone,
        answers,
        requirement_report: report,
        demo_requested_at: demoYes ? new Date().toISOString() : null,
      })
      .select("id, current_price")
      .single();

    if (createError || !created) {
      console.error("interview create conversation failed", { code: createError?.code });
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }

    const intakeText = [
      "[STRUCTURED INTAKE]",
      `Language: ${language}`,
      report.summary,
      demoYes ? "Demo requested: yes" : "Demo requested: no",
    ].join("\n");

    await supabase.from("ai_messages").insert({
      conversation_id: created.id,
      role: "user",
      content: intakeText,
    });

    let reply =
      "Thanks — your details are saved. The MAXWEB team can read this full intake and chat. Tell me anything else about your website, or ask about scope and price (₹15,000 → ₹7,000).";

    if (askAi && process.env.MAXWEB_AI_API_KEY2?.trim()) {
      try {
        const messages: ChatMessage[] = [
          {
            role: "system",
            content:
              "You are MAXWEB’s website consultant. The client completed a structured intake. Acknowledge their project in under 120 words, clarify one useful question, and mention price band ₹15,000 to ₹7,000. Prefer their language if not English. Never finalize a contract price — admin approval is required. Full transcript is stored for the human team.",
          },
          { role: "user", content: intakeText },
        ];
        const result = await completeAI(messages, { temperature: 0.45, maxOutputTokens: 220 });
        reply = result.content;
        await supabase.from("ai_messages").insert({
          conversation_id: created.id,
          role: "assistant",
          content: reply,
          metadata: { model: result.model, provider: result.provider, source: "interview" },
        });
      } catch (err) {
        if (!(err instanceof ProviderError)) throw err;
        // Keep intake even if AI fails.
      }
    }

    return NextResponse.json({
      ok: true,
      conversationId: created.id,
      currentPrice: created.current_price,
      report,
      reply,
      demoRequested: demoYes,
    });
  } catch (error) {
    console.error("interview submit failed", {
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
