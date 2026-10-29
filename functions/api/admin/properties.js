/**
 * Admin CRUD for properties (developments)
 * GET    /api/admin/properties     – list all
 * POST   /api/admin/properties     – create (requires verified address from Google Places)
 * PUT    /api/admin/properties     – update
 * DELETE /api/admin/properties?id= – delete
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

  try {
    const result = await env.DB.prepare(
      `SELECT id, name, code, address, place_id, formatted_address, lat, lng, created_at
       FROM developments ORDER BY name`
    ).all();
    return json({ success: true, properties: result.results || [] });
  } catch (err) {
    return json({ error: 'Failed to list properties', details: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = checkAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const name = (body.name || '').toString().trim();
    const code = (body.code || '').toString().trim() || null;
    const address = (body.address || '').toString().trim();
    const place_id = (body.place_id || '').toString().trim() || null;
    const formatted_address = (body.formatted_address || '').toString().trim() || address;
    const lat = body.lat != null ? Number(body.lat) : null;
    const lng = body.lng != null ? Number(body.lng) : null;

    if (!name) return json({ error: 'Property name is required' }, 400);
    if (!address && !formatted_address) return json({ error: 'A verified address is required' }, 400);
    if (!place_id) return json({ error: 'Address must be selected from Google Places suggestions' }, 400);

    await env.DB.prepare(
      `INSERT INTO developments (name, code, address, place_id, formatted_address, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(name, code, address || formatted_address, place_id, formatted_address, lat, lng).run();

    const row = await env.DB.prepare(
      'SELECT id, name, code, address, place_id, formatted_address, lat, lng FROM developments WHERE name = ?'
    ).bind(name).first();

    return json({ success: true, property: row });
  } catch (err) {
    if (String(err.message || err).includes('UNIQUE')) {
      return json({ error: 'A property with that name or code already exists' }, 409);
    }
    return json({ error: 'Failed to create property', details: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = checkAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const id = parseInt(body.id, 10);
    if (!id) return json({ error: 'Property id is required' }, 400);

    const name = (body.name || '').toString().trim();
    const code = (body.code || '').toString().trim() || null;
    const address = (body.address || '').toString().trim();
    const place_id = (body.place_id || '').toString().trim() || null;
    const formatted_address = (body.formatted_address || '').toString().trim() || address;
    const lat = body.lat != null ? Number(body.lat) : null;
    const lng = body.lng != null ? Number(body.lng) : null;

    if (!name) return json({ error: 'Property name is required' }, 400);

    await env.DB.prepare(
      `UPDATE developments
       SET name = ?, code = ?, address = ?, place_id = ?, formatted_address = ?, lat = ?, lng = ?
       WHERE id = ?`
    ).bind(name, code, address || formatted_address, place_id, formatted_address, lat, lng, id).run();

    const row = await env.DB.prepare(
      'SELECT id, name, code, address, place_id, formatted_address, lat, lng FROM developments WHERE id = ?'
    ).bind(id).first();

    return json({ success: true, property: row });
  } catch (err) {
    if (String(err.message || err).includes('UNIQUE')) {
      return json({ error: 'A property with that name or code already exists' }, 409);
    }
    return json({ error: 'Failed to update property', details: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const auth = checkAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id'), 10);
    if (!id) return json({ error: 'Property id is required' }, 400);

    // Prevent delete if incidents exist
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM incidents WHERE development_id = ?'
    ).bind(id).first();
    if (count && count.c > 0) {
      return json({ error: 'Cannot delete a property that has existing incidents' }, 400);
    }

    await env.DB.prepare('DELETE FROM developments WHERE id = ?').bind(id).run();
    return json({ success: true });
  } catch (err) {
    return json({ error: 'Failed to delete property', details: err.message }, 500);
  }
}
