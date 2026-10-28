/**
 * GET /api/developments
 * Public list of developments for the report form dropdown
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({
        error: 'Database not bound. Add D1 binding named DB in Pages Settings → Bindings.'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await env.DB.prepare(
      'SELECT id, name, code FROM developments ORDER BY name'
    ).all();

    return new Response(JSON.stringify({
      success: true,
      developments: result.results || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Failed to load developments',
      details: err.message || String(err)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
