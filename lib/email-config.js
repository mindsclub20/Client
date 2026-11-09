export function getSmtpConfig(env = process.env) {
  const host = env.SMTP_HOST?.trim();
  const rawPort = env.SMTP_PORT || '465';
  const port = Number(rawPort);
  const rawSecure = env.SMTP_SECURE;
  const secure = rawSecure == null || rawSecure === ''
    ? port === 465
    : String(rawSecure).toLowerCase() === 'true';
  const emailFrom = env.EMAIL_FROM?.trim();
  const user = env.SMTP_USER?.trim() || emailFrom;
  const pass = env.SMTP_PASS?.replace(/\s+/g, '');
  const from = emailFrom || user;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port.');
  }
  if (!host || !user || !pass || !from) {
    throw new Error('SMTP configuration is incomplete. Set SMTP_HOST, SMTP_PASS, and EMAIL_FROM (SMTP_USER is optional when it matches EMAIL_FROM).');
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    from,
  };
}
