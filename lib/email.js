import nodemailer from 'nodemailer';
import { getSmtpConfig } from './email-config.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function sanitizeSmtpMessage(value) {
  return String(value || 'No provider message supplied')
    .replace(/[\\r\\n\\t]+/g, ' ')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(pass(word)?|auth|token|secret)\\s*[:=]\\s*[^\\s,;]+/gi, '$1=[redacted]')
    .slice(0, 240);
}

export function classifySmtpError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.response || error?.message || '');
  if (/534|5\\.7\\.(9|14)|application-specific password|account.{0,20}(disabled|restricted|blocked)|access.{0,20}(denied|blocked)/i.test(message)) {
    return 'GMAIL_ACCESS_RESTRICTION';
  }
  if (code === 'EAUTH') return 'INVALID_CREDENTIALS';
  if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(code)) return 'CONNECTION_TIMEOUT';
  if (['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)) return 'DNS_OR_NETWORK_FAILURE';
  if (['CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(code) || /certificate|tls|ssl/i.test(message)) {
    return 'TLS_OR_CERTIFICATE_FAILURE';
  }
  return 'SMTP_DELIVERY_FAILURE';
}

export async function sendTransactionalEmail(
  { to, subject, text, url },
  transportFactory = nodemailer.createTransport,
) {
  const config = getSmtpConfig();
  const { from, ...transportConfig } = config;
  const safeUrl = url ? escapeHtml(url) : '';
  const bodyText = text || (url ? `Open this secure MAXWEB link: ${url}` : '');
  const html = url
    ? `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17243a"><h2>${escapeHtml(subject)}</h2><p>Use the link below to continue:</p><p><a href="${safeUrl}">Continue to MAXWEB</a></p><p>If you did not request this, you can ignore this email.</p></div>`
    : `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17243a"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(bodyText)}</p></div>`;

  const transporter = transportFactory({
    ...transportConfig,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await transporter.sendMail({ from, to, subject, text: bodyText, html });
  } catch (error) {
    const code = String(error?.code || error?.name || 'UNKNOWN').slice(0, 40);
    console.error('Transactional SMTP email delivery failed', {
      classification: classifySmtpError(error),
      code,
      message: sanitizeSmtpMessage(error?.response || error?.message),
      host: config.host,
      port: config.port,
      tlsMode: config.secure ? 'implicit-tls' : 'starttls',
      usernamePresent: Boolean(config.auth.user),
      senderPresent: Boolean(from),
    });
    throw new Error('Email delivery failed. Please try again later.');
  } finally {
    transporter.close();
  }
}
