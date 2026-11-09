function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export async function sendTransactionalEmail({ to, subject, text, url }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL (or EMAIL_FROM).');
  }
  const safeUrl = url ? escapeHtml(url) : '';
  const bodyText = text || (url ? `Open this secure MAXWEB link: ${url}` : '');
  const html = url
    ? `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17243a"><h2>${escapeHtml(subject)}</h2><p>Use the link below to continue:</p><p><a href="${safeUrl}">Continue to MAXWEB</a></p><p>If you did not request this, you can ignore this email.</p></div>`
    : `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17243a"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(bodyText)}</p></div>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text: bodyText, html }),
  });
  if (!response.ok) {
    const providerMessage = await response.text().catch(() => '');
    console.error('Transactional email delivery failed', response.status, providerMessage.slice(0, 300));
    throw new Error('Email delivery failed. Please try again later.');
  }
}
