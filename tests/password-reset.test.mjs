import test from 'node:test';
import assert from 'node:assert/strict';
import { readPasswordResetState, validateNewPassword } from '../js/password-reset-helpers.js';

test('reads a valid one-time password reset token', () => {
  assert.deepEqual(readPasswordResetState('?token=single-use-token'), {
    token: 'single-use-token', invalid: false,
  });
});

test('rejects missing, blank, or invalid reset tokens', () => {
  assert.deepEqual(readPasswordResetState(''), { token: null, invalid: true });
  assert.deepEqual(readPasswordResetState('?token=%20%20'), { token: null, invalid: true });
  assert.deepEqual(readPasswordResetState('?error=INVALID_TOKEN'), { token: null, invalid: true });
});

test('enforces password length and matching confirmation', () => {
  assert.equal(validateNewPassword('short', 'short'), 'Use a password of at least 8 characters.');
  assert.equal(validateNewPassword('x'.repeat(129), 'x'.repeat(129)), 'Use a password no longer than 128 characters.');
  assert.equal(validateNewPassword('correct-horse', 'different-password'), 'The passwords do not match.');
  assert.equal(validateNewPassword('correct-horse', 'correct-horse'), null);
});
