export function getSmtpConfig(env = process.env) {
  const host = env.SMTP_HOST?.trim();
  const rawPort = env.SMTP_PORT || '465';
  const port = Number(rawPort);
  const rawSecure = env.SMTP_SECURE;
  const secure = rawSecure == null || rawSecure === ''
    ? port === 465
    : String(rawSecure).toLowerCase() === 'true';
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.replace(/\s+/g, '');
  const from = env.EMAIL_FROM?.trim() || user;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port.');
  }
  if (!host || !user || !pass || !from) {
    throw new Error('SMTP configuration is incomplete. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM.');
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    from,
  };
}
