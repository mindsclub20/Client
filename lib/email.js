import nodemailer from 'nodemailer';
import { getSmtpConfig } from './email-config.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export async function sendTransactionalEmail({ to, subject, text, url }) {
  const config = getSmtpConfig();
  const { from, ...transportConfig } = config;
  const safeUrl = url ? escapeHtml(url) : '';
  const bodyText = text || (url ? `Open this secure MAXWEB link: ${url}` : '');
  const html = url
    ? `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17243a"><h2>${escapeHtml(subject)}</h2><p>Use the link below to continue:</p><p><a href="${safeUrl}">Continue to MAXWEB</a></p><p>If you did not request this, you can ignore this email.</p></div>`
    : `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17243a"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(bodyText)}</p></div>`;

  const transporter = nodemailer.createTransport({
    ...transportConfig,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await transporter.sendMail({ from, to, subject, text: bodyText, html });
  } catch (error) {
    console.error('Transactional SMTP email delivery failed', error?.code || error?.name || 'UNKNOWN');
    throw new Error('Email delivery failed. Please try again later.');
  } finally {
    transporter.close();
  }
}
