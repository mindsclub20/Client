/** Restore the original Better Auth URL after Vercel rewrites nested auth paths. */
export function routeAuthRequest(request) {
  const incomingUrl = new URL(request.url);
  const authPath = incomingUrl.searchParams.get('path');
  if (!authPath) {
    return new Response('Missing auth route path', { status: 400 });
  }

  const segments = authPath.replace(/^\/+/, '').split('/');
  if (segments.length === 0 || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return new Response('Invalid auth route path', { status: 400 });
  }

  const targetUrl = new URL(`/api/auth/${segments.join('/')}`, incomingUrl.origin);
  for (const [key, value] of incomingUrl.searchParams) {
    if (key !== 'path') targetUrl.searchParams.append(key, value);
  }

  return new Request(targetUrl, request);
}
