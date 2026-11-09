import test from 'node:test';
import assert from 'node:assert/strict';
import { getSmtpConfig } from '../lib/email-config.js';

const validEnv = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'sender@gmail.com',
  SMTP_PASS: 'abcd efgh ijkl mnop',
  EMAIL_FROM: 'sender@gmail.com',
};

test('builds Gmail SMTP settings and normalizes Google App Password spaces', () => {
  assert.deepEqual(getSmtpConfig(validEnv), {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: 'sender@gmail.com', pass: 'abcdefghijklmnop' },
    from: 'sender@gmail.com',
  });
});

test('uses the sender account as the default From address', () => {
  const { from, ...config } = getSmtpConfig({ ...validEnv, EMAIL_FROM: '' });
  assert.equal(from, 'sender@gmail.com');
  assert.equal(config.host, 'smtp.gmail.com');
});

test('rejects missing SMTP credentials instead of silently falling back to Resend', () => {
  assert.throws(
    () => getSmtpConfig({ ...validEnv, SMTP_PASS: '' }),
    /SMTP configuration is incomplete/,
  );
});

test('rejects invalid SMTP ports', () => {
  assert.throws(
    () => getSmtpConfig({ ...validEnv, SMTP_PORT: 'not-a-port' }),
    /SMTP_PORT must be a valid port/,
  );
});
