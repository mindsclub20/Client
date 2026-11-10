import { text, email } from './validation.js';

function safeString(value, max = 500) {
  return typeof value === 'string' ? text(value, { min: 0, max }) : null;
}

export function normalizeSalesResponse(raw, pricingRules = []) {
  const serviceType = safeString(raw?.service_type, 120);
  const rule = pricingRules.find((item) =>
    String(item.service_type || '').trim().toLowerCase() === String(serviceType || '').trim().toLowerCase()
  );
  const candidate = raw?.proposed_price == null || raw?.proposed_price === '' ? null : Number(raw.proposed_price);
  const hasCandidate = candidate !== null;
  const minimum = rule ? Number(rule.minimum_price) : NaN;
  const base = rule ? Number(rule.base_price) : NaN;
  const maxDiscount = rule ? Number(rule.max_discount_percent) : NaN;
  const effectiveMinimum = Math.max(minimum, base * (1 - maxDiscount / 100));
  const priceIsAllowed = Number.isFinite(candidate) && Number.isFinite(effectiveMinimum) && Number.isFinite(base)
    && candidate >= effectiveMinimum && candidate <= base;
  const proposedPrice = priceIsAllowed ? Math.round(candidate * 100) / 100 : null;
  const sourceSummary = raw?.summary && typeof raw.summary === 'object' && !Array.isArray(raw.summary) ? raw.summary : {};
  const features = Array.isArray(sourceSummary.features)
    ? sourceSummary.features.slice(0, 20).map((value) => safeString(value, 180)).filter(Boolean)
    : [];
  const customerName = safeString(raw?.customer_name || sourceSummary.customer_name, 120);
  const customerEmail = email(raw?.email || sourceSummary.email);
  const phone = safeString(raw?.phone || sourceSummary.phone, 32);
  const summary = {
    business: safeString(sourceSummary.business, 180),
    requirements: safeString(sourceSummary.requirements, 3000),
    features,
    timeline: safeString(sourceSummary.timeline, 160),
    budget: safeString(sourceSummary.budget, 160),
    additionalNotes: safeString(sourceSummary.additional_notes, 1200),
  };
  return {
    reply: safeString(raw?.reply, 1800) || 'I have recorded your message. The MAXWEB team can review the details and follow up.',
    serviceType,
    customerName,
    email: customerEmail,
    phone,
    summary,
    proposedPrice,
    priceStatus: hasCandidate ? 'review_required' : 'not_proposed',
    readyForAdminReview: raw?.ready_for_admin_review === true,
  };
}

function parseJsonObject(content) {
  if (typeof content !== 'string') throw new Error('AI provider returned an empty response');
  const cleaned = content.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, '');
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error('AI provider returned an invalid structured response');
}

export function buildSalesSystemPrompt(pricingRules = []) {
  const pricing = pricingRules.map((rule) => ({
    service: rule.service_type,
    base_price_inr: Number(rule.base_price),
    minimum_price_inr: Number(rule.minimum_price),
    max_discount_percent: Number(rule.max_discount_percent),
  }));
  return [
    'You are Priya, MAXWEB\'s customer discovery and sales assistant.',
    'Your job is to understand the customer\'s website or digital-service requirements and prepare a provisional proposal for human review.',
    'Ask one concise question at a time. Collect business context, service type, required pages/features, design preferences, timeline, budget, and contact details when appropriate.',
    'Be accurate, polite, and concise. Never invent portfolio items, delivery dates, service capabilities, policies, or prices.',
    'Use only the active pricing rules supplied below. A proposed price must be between the configured minimum and base price, inclusive. If no matching rule exists, do not invent a price.',
    'A price is always provisional. You cannot approve a quotation, promise a discount outside the configured limits, create a project, request payment, or make a binding commitment. A MAXWEB administrator must review and approve every final quotation.',
    'When the customer has provided enough information for the team to prepare a quote, set ready_for_admin_review to true and provide a structured summary.',
    'Return only one valid JSON object with these keys: reply (string), service_type (string or null), customer_name (string or null), email (string or null), phone (string or null), summary (object with business, requirements, features array, timeline, budget, additional_notes), proposed_price (number or null), ready_for_admin_review (boolean).',
    'Active pricing rules (INR): ' + JSON.stringify(pricing),
  ].join('\n');
}

function configuredProviders() {
  const providers = [];
  const primaryKey = process.env.MAXWEB_AI_API_KEY;
  const primaryModel = process.env.MAXWEB_AI_MODEL;
  if (primaryKey && primaryModel) {
    providers.push({
      name: 'gemini',
      apiKey: primaryKey,
      model: primaryModel,
      baseUrl: (process.env.MAXWEB_AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/+$/, ''),
    });
  }
  const xaiKey = process.env.XAI_API_KEY;
  const xaiModel = process.env.XAI_MODEL;
  if (xaiKey && xaiModel) {
    providers.push({
      name: 'xai',
      apiKey: xaiKey,
      model: xaiModel,
      baseUrl: (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/+$/, ''),
    });
  }
  return providers;
}

export function isSalesAssistantConfigured() {
  return configuredProviders().length > 0;
}

async function callSalesProvider(provider, messages, pricingRules) {
  const response = await fetch(provider.baseUrl + '/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + provider.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: buildSalesSystemPrompt(pricingRules) },
        ...messages.slice(-24).map((message) => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: String(message.content || '').slice(0, 2000),
        })),
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    const error = new Error('AI_PROVIDER_ERROR');
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  return parseJsonObject(payload?.choices?.[0]?.message?.content);
}

export async function requestSalesAssistant(messages, pricingRules = []) {
  const providers = configuredProviders();
  if (!providers.length) throw new Error('AI_NOT_CONFIGURED');
  let lastError;
  for (const provider of providers) {
    try {
      return await callSalesProvider(provider, messages, pricingRules);
    } catch (error) {
      lastError = error;
      console.error('MAXWEB AI provider failed', provider.name, Number.isInteger(error?.status) ? error.status : 'request_error');
    }
  }
  throw lastError || new Error('AI_PROVIDER_ERROR');
}
