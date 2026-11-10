export async function GET() {
  return Response.json({ error: 'auth_provider_moved', message: 'MAXWEB authentication is managed by Supabase Auth.' }, {
    status: 410, headers: { 'cache-control': 'no-store' },
  });
}
export async function POST() {
  return Response.json({ error: 'auth_provider_moved', message: 'Use the Supabase Auth client for account operations.' }, {
    status: 410, headers: { 'cache-control': 'no-store' },
  });
}
