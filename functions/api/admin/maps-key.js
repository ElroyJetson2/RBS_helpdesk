/**
 * GET /api/admin/maps-key
 * Returns the Google Maps API key only to authenticated staff.
 * Set GOOGLE_MAPS_API_KEY in Cloudflare Pages environment variables.
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function checkAuth(request) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) {
    return { ok: false, response: json({ error: 'Unauthorized' }, 401) };
  }
  return { ok: true };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = checkAuth(request);
  if (!auth.ok) return auth.response;

  const key = (env.GOOGLE_MAPS_API_KEY || '').trim();
  if (!key) {
    return json({ error: 'Google Maps API key not configured' }, 500);
  }

  return json({ success: true, key });
}
