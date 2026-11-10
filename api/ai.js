import { createHash } from 'node:crypto';
import { pool } from '../lib/db.js';
import { getSupabaseUser } from '../lib/supabase-auth.js';
import { sameOrigin, json } from '../lib/access.js';
import { text } from '../lib/validation.js';
import { normalizeSalesResponse, requestSalesAssistant } from '../lib/ai.js';

const SOURCES = new Set(['website', 'client_portal', 'instagram', 'whatsapp', 'phone']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function rateLimited(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const address = forwarded.split(',')[0].trim() || 'unknown';
  const secret = process.env.MAXWEB_AI_API_KEY || 'maxweb-ai-rate-limit';
  const keyHash = createHash('sha256').update(secret + ':' + address).digest('hex');
  const { rows } = await pool.query(
    `INSERT INTO public.maxweb_ai_rate_limits(key_hash, window_started_at, request_count)
     VALUES($1, now(), 1)
     ON CONFLICT (key_hash) DO UPDATE SET
       request_count = CASE
         WHEN public.maxweb_ai_rate_limits.window_started_at < now() - interval '1 minute' THEN 1
         ELSE public.maxweb_ai_rate_limits.request_count + 1
       END,
       window_started_at = CASE
         WHEN public.maxweb_ai_rate_limits.window_started_at < now() - interval '1 minute' THEN now()
         ELSE public.maxweb_ai_rate_limits.window_started_at
       END,
       updated_at = now()
     RETURNING request_count`,
    [keyHash]
  );
  return Number(rows[0]?.request_count || 0) > 12;
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'invalid_origin' }, 403);
  if (!process.env.MAXWEB_AI_API_KEY || !process.env.MAXWEB_AI_MODEL) {
    return json({ error: 'ai_not_configured', message: 'The assistant is temporarily unavailable. Use the call, Instagram, or WhatsApp contact options.' }, 503);
  }
  try {
    if (await rateLimited(request)) return json({ error: 'rate_limited' }, 429);
    const body = await request.json().catch(() => null);
    const message = text(body?.message, { max: 2000 });
    if (!message) return json({ error: 'invalid_message' }, 400);
    const source = SOURCES.has(body?.source) ? body.source : 'website';
    const user = await getSupabaseUser(request);
    const userId = user?.id || null;
    let conversation;
    if (body?.conversationId) {
      if (typeof body.conversationId !== 'string' || !UUID.test(body.conversationId)) {
        return json({ error: 'invalid_conversation' }, 400);
      }
      const found = await pool.query('SELECT id,user_id,transcript,status FROM public.maxweb_ai_conversations WHERE id=$1', [body.conversationId]);
      conversation = found.rows[0];
      if (!conversation) return json({ error: 'conversation_not_found' }, 404);
      if (conversation.user_id && conversation.user_id !== userId) return json({ error: 'forbidden' }, 403);
      if (!conversation.user_id && userId) {
        await pool.query('UPDATE public.maxweb_ai_conversations SET user_id=$2 WHERE id=$1 AND user_id IS NULL', [conversation.id, userId]);
      }
    } else {
      const created = await pool.query(
        'INSERT INTO public.maxweb_ai_conversations(user_id,source) VALUES($1,$2) RETURNING id,user_id,transcript,status',
        [userId, source]
      );
      conversation = created.rows[0];
    }
    const transcript = Array.isArray(conversation.transcript) ? conversation.transcript : [];
    if (transcript.length >= 40) return json({ error: 'conversation_limit_reached' }, 429);
    const rules = await pool.query(
      'SELECT service_type,base_price,minimum_price,max_discount_percent FROM public.maxweb_pricing_rules WHERE active=true ORDER BY service_type'
    );
    const userMessage = { role: 'user', content: message, createdAt: new Date().toISOString() };
    const raw = await requestSalesAssistant([...transcript, userMessage], rules.rows);
    const result = normalizeSalesResponse(raw, rules.rows);
    const assistantMessage = { role: 'assistant', content: result.reply, createdAt: new Date().toISOString() };
    const nextTranscript = [...transcript, userMessage, assistantMessage].slice(-40);
    const nextStatus = result.readyForAdminReview ? 'needs_admin_review' : (conversation.status || 'open');
    const summary = {
      ...result.summary,
      customer_name: result.customerName,
      email: result.email,
      phone: result.phone,
    };
    await pool.query(
      `UPDATE public.maxweb_ai_conversations
       SET user_id=COALESCE(user_id,$2),
           customer_name=COALESCE($3,customer_name),
           email=COALESCE($4,email),
           phone=COALESCE($5,phone),
           service_type=COALESCE($6,service_type),
           transcript=$7::jsonb,
           summary=$8::jsonb,
           proposed_price=$9,
           price_status=$10,
           status=$11,
           updated_at=now()
       WHERE id=$1`,
      [conversation.id, userId, result.customerName, result.email, result.phone, result.serviceType,
        JSON.stringify(nextTranscript), JSON.stringify(summary), result.proposedPrice, result.priceStatus, nextStatus]
    );
    return json({ conversationId: conversation.id, reply: result.reply, submittedForReview: result.readyForAdminReview, accountRequired: !userId && result.readyForAdminReview });
  } catch (error) {
    if (error?.message === 'AI_NOT_CONFIGURED') {
      return json({ error: 'ai_not_configured', message: 'The assistant is temporarily unavailable.' }, 503);
    }
    console.error('MAXWEB AI chat failed', error?.message);
    return json({ error: 'assistant_unavailable', message: 'The assistant could not respond right now. Please contact MAXWEB directly.' }, 502);
  }
}
