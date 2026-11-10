import test from 'node:test';
import assert from 'node:assert/strict';
import { getSmtpConfig } from '../lib/email-config.js';
import { classifySmtpError, sendTransactionalEmail } from '../lib/email.js';

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

test('uses EMAIL_FROM as the SMTP username when SMTP_USER is not configured', () => {
  const config = getSmtpConfig({ ...validEnv, SMTP_USER: undefined });
  assert.equal(config.auth.user, 'sender@gmail.com');
  assert.equal(config.from, 'sender@gmail.com');
});

test('defaults secure SMTP to true on port 465', () => {
  const config = getSmtpConfig({ ...validEnv, SMTP_SECURE: undefined });
  assert.equal(config.secure, true);
});

test('uses STARTTLS mode when secure is explicitly false', () => {
  const config = getSmtpConfig({ ...validEnv, SMTP_SECURE: 'false' });
  assert.equal(config.secure, false);
});

test('rejects missing SMTP credentials instead of silently falling back to another provider', () => {
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

test('classifies authentication, network, timeout, TLS and Gmail restriction errors', () => {
  assert.equal(classifySmtpError({ code: 'EAUTH', message: 'Invalid login' }), 'INVALID_CREDENTIALS');
  assert.equal(classifySmtpError({ code: 'ETIMEDOUT' }), 'CONNECTION_TIMEOUT');
  assert.equal(classifySmtpError({ code: 'ENOTFOUND' }), 'DNS_OR_NETWORK_FAILURE');
  assert.equal(classifySmtpError({ code: 'CERT_HAS_EXPIRED' }), 'TLS_OR_CERTIFICATE_FAILURE');
  assert.equal(classifySmtpError({ code: 'EAUTH', response: '534 5.7.9 Application-specific password required' }), 'GMAIL_ACCESS_RESTRICTION');
});

test('delivers email through an injected mocked SMTP transport', async () => {
  const previous = { ...process.env };
  Object.assign(process.env, validEnv);
  let sent;
  let transportOptions;
  let closed = false;
  try {
    await sendTransactionalEmail(
      { to: 'recipient@example.com', subject: 'Verify', url: 'https://example.com/verify' },
      (options) => {
        transportOptions = options;
        return {
          async sendMail(message) { sent = message; },
          close() { closed = true; },
        };
      },
    );
    assert.equal(transportOptions.host, 'smtp.gmail.com');
    assert.equal(transportOptions.port, 465);
    assert.equal(transportOptions.secure, true);
    assert.equal(sent.from, 'sender@gmail.com');
    assert.equal(sent.to, 'recipient@example.com');
    assert.equal(closed, true);
  } finally {
    for (const key of Object.keys(validEnv)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test('classifies SMTP authentication failure and does not expose provider details to callers', async () => {
  const previous = { ...process.env };
  Object.assign(process.env, validEnv);
  const originalError = console.error;
  let logged;
  console.error = (...args) => { logged = args; };
  try {
    await assert.rejects(
      sendTransactionalEmail(
        { to: 'recipient@example.com', subject: 'Verify', text: 'Verify account' },
        () => ({
          async sendMail() {
            const error = new Error('Invalid login for sender@gmail.com');
            error.code = 'EAUTH';
            throw error;
          },
          close() {},
        }),
      ),
      { message: 'Email delivery failed. Please try again later.' },
    );
    assert.equal(logged[1].classification, 'INVALID_CREDENTIALS');
    assert.equal(logged[1].code, 'EAUTH');
    assert.equal(logged[1].usernamePresent, true);
    assert.equal(logged[1].senderPresent, true);
    assert.doesNotMatch(JSON.stringify(logged), /sender@gmail.com|abcdefghijklmnop/);
  } finally {
    console.error = originalError;
    for (const key of Object.keys(validEnv)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
