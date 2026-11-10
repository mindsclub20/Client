export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return Response.json({ error: 'supabase_not_configured' }, {
      status: 503, headers: { 'cache-control': 'no-store' },
    });
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      throw new Error('invalid_supabase_url');
    }
  } catch {
    return Response.json({ error: 'supabase_not_configured' }, {
      status: 503, headers: { 'cache-control': 'no-store' },
    });
  }
  return Response.json({ url, publishableKey: key }, {
    headers: { 'cache-control': 'public, max-age=300' },
  });
}
