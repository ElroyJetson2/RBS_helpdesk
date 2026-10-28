// Simple CORS + JSON helper middleware for all /api routes
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Only apply to API routes
  if (!url.pathname.startsWith('/api')) {
    return context.next();
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  const response = await context.next();
  // Clone so we can add headers
  const newResponse = new Response(response.body, response);
  Object.entries(corsHeaders()).forEach(([k, v]) => newResponse.headers.set(k, v));
  return newResponse;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}
