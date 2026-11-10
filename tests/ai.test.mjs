import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSalesResponse } from '../lib/ai.js';

const rules = [{ service_type: 'Website development', base_price: '6000', minimum_price: '5000', max_discount_percent: '16.67' }];

test('accepts a proposed price only inside the configured admin range', () => {
  const result = normalizeSalesResponse({
    reply: 'I have enough details to prepare a proposal.',
    service_type: 'Website development',
    proposed_price: 5500,
    ready_for_admin_review: true,
    summary: { requirements: 'Five-page business website' },
  }, rules);
  assert.equal(result.proposedPrice, 5500);
  assert.equal(result.priceStatus, 'review_required');
  assert.equal(result.readyForAdminReview, true);
});

test('does not expose a proposed price below the configured minimum', () => {
  const result = normalizeSalesResponse({
    reply: 'I will ask the team to review this request.',
    service_type: 'Website development',
    proposed_price: 4500,
    ready_for_admin_review: true,
  }, rules);
  assert.equal(result.proposedPrice, null);
  assert.equal(result.priceStatus, 'review_required');
});

test('does not invent a price for services without an active pricing rule', () => {
  const result = normalizeSalesResponse({
    reply: 'The team will review this custom request.',
    service_type: 'Security and privacy',
    proposed_price: 9000,
    ready_for_admin_review: true,
  }, rules);
  assert.equal(result.proposedPrice, null);
  assert.equal(result.priceStatus, 'review_required');
});

test('validates customer contact details extracted from the conversation', () => {
  const result = normalizeSalesResponse({
    reply: 'Thank you.',
    service_type: 'Website development',
    customer_name: ' Test Customer ',
    email: 'not-an-email',
    phone: ' 9876543210 ',
    summary: { features: ['Contact form', 'Gallery'] },
  }, rules);
  assert.equal(result.customerName, 'Test Customer');
  assert.equal(result.email, null);
  assert.equal(result.phone, '9876543210');
  assert.deepEqual(result.summary.features, ['Contact form', 'Gallery']);
});

test('enforces the configured maximum discount even when minimum price is lower', () => {
  const strictRules = [{ service_type: 'Website development', base_price: '6000', minimum_price: '5000', max_discount_percent: '5' }];
  const rejected = normalizeSalesResponse({ reply: 'Review', service_type: 'Website development', proposed_price: 5500 }, strictRules);
  const accepted = normalizeSalesResponse({ reply: 'Review', service_type: 'Website development', proposed_price: 5700 }, strictRules);
  assert.equal(rejected.proposedPrice, null);
  assert.equal(accepted.proposedPrice, 5700);
});


test('reports the assistant configured when either provider has complete credentials', async () => {
  const { isSalesAssistantConfigured } = await import('../lib/ai.js');
  const saved = Object.fromEntries(['MAXWEB_AI_API_KEY','MAXWEB_AI_MODEL','XAI_API_KEY','XAI_MODEL'].map(k=>[k,process.env[k]]));
  try {
    delete process.env.MAXWEB_AI_API_KEY; delete process.env.MAXWEB_AI_MODEL;
    process.env.XAI_API_KEY = 'xai-test-key'; process.env.XAI_MODEL = 'grok-4.7';
    assert.equal(isSalesAssistantConfigured(), true);
    delete process.env.XAI_API_KEY; delete process.env.XAI_MODEL;
    assert.equal(isSalesAssistantConfigured(), false);
  } finally {
    for (const [k,v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k]=v; }
  }
});

test('falls back to Grok when the primary Gemini-compatible endpoint fails', async () => {
  const { requestSalesAssistant } = await import('../lib/ai.js');
  const saved = Object.fromEntries(['MAXWEB_AI_API_KEY','MAXWEB_AI_MODEL','MAXWEB_AI_BASE_URL','XAI_API_KEY','XAI_MODEL','XAI_BASE_URL'].map(k=>[k,process.env[k]]));
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    process.env.MAXWEB_AI_API_KEY = 'gemini-test-key';
    process.env.MAXWEB_AI_MODEL = 'gemini-3.8-flash';
    process.env.MAXWEB_AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
    process.env.XAI_API_KEY = 'xai-test-key';
    process.env.XAI_MODEL = 'grok-4.7';
    process.env.XAI_BASE_URL = 'https://api.x.ai/v1';
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), authorization: options.headers.authorization });
      if (calls.length === 1) return new Response('unavailable', { status: 503 });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: 'Grok fallback works.' }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const result = await requestSalesAssistant([{ role: 'user', content: 'Hello' }], rules);
    assert.equal(result.reply, 'Grok fallback works.');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    assert.equal(calls[1].url, 'https://api.x.ai/v1/chat/completions');
    assert.equal(calls[0].authorization, 'Bearer gemini-test-key');
    assert.equal(calls[1].authorization, 'Bearer xai-test-key');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [k,v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k]=v; }
  }
});
