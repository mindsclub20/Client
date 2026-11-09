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
