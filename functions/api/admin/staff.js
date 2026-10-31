import { json, getStaffFromRequest } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const staff = await getStaffFromRequest(env, request);
  if (!staff) return json({ error: 'Unauthorized' }, 401);
  if (staff.role !== 'admin') return json({ error: 'Admin only' }, 403);

  try {
    const result = await env.DB.prepare(
      `SELECT id, username, display_name, role, email, created_at FROM staff ORDER BY role, display_name`
    ).all();
    return json({ success: true, staff: result.results || [] });
  } catch (err) {
    return json({ error: 'Failed to list staff', details: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const me = await getStaffFromRequest(env, request);
  if (!me) return json({ error: 'Unauthorized' }, 401);
  if (me.role !== 'admin') return json({ error: 'Admin only' }, 403);

  try {
    const body = await request.json();
    const username = (body.username || '').trim().toLowerCase().replace(/\s+/g, '');
    const password = (body.password || '').trim();
    const display_name = (body.display_name || '').trim();
    const role = (body.role || 'contractor').trim();
    const email = (body.email || '').trim() || null;

    if (!username || !password || !display_name) {
      return json({ error: 'Username, password and display name are required' }, 400);
    }
    if (!['admin', 'viewer', 'contractor'].includes(role)) {
      return json({ error: 'Invalid role' }, 400);
    }

    await env.DB.prepare(
      `INSERT INTO staff (username, password_hash, display_name, role, email) VALUES (?, ?, ?, ?, ?)`
    ).bind(username, password, display_name, role, email).run();

    return json({ success: true });
  } catch (err) {
    if (String(err.message || err).includes('UNIQUE')) {
      return json({ error: 'Username already exists' }, 400);
    }
    return json({ error: 'Failed to create staff', details: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const me = await getStaffFromRequest(env, request);
  if (!me) return json({ error: 'Unauthorized' }, 401);
  if (me.role !== 'admin') return json({ error: 'Admin only' }, 403);

  try {
    const body = await request.json();
    const id = body.id;
    if (!id) return json({ error: 'ID required' }, 400);

    const display_name = (body.display_name || '').trim();
    const role = (body.role || '').trim();
    const email = (body.email || '').trim() || null;
    const password = (body.password || '').trim();

    if (display_name) {
      await env.DB.prepare(`UPDATE staff SET display_name = ? WHERE id = ?`).bind(display_name, id).run();
    }
    if (role && ['admin', 'viewer', 'contractor'].includes(role)) {
      await env.DB.prepare(`UPDATE staff SET role = ? WHERE id = ?`).bind(role, id).run();
    }
    if (email !== undefined) {
      await env.DB.prepare(`UPDATE staff SET email = ? WHERE id = ?`).bind(email, id).run();
    }
    if (password) {
      await env.DB.prepare(`UPDATE staff SET password_hash = ? WHERE id = ?`).bind(password, id).run();
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: 'Failed to update staff', details: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const me = await getStaffFromRequest(env, request);
  if (!me) return json({ error: 'Unauthorized' }, 401);
  if (me.role !== 'admin') return json({ error: 'Admin only' }, 403);

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ error: 'ID required' }, 400);

    const row = await env.DB.prepare(`SELECT username FROM staff WHERE id = ?`).bind(id).first();
    if (row && row.username === 'admin') {
      return json({ error: 'Cannot delete the main admin account' }, 400);
    }

    await env.DB.prepare(`DELETE FROM staff WHERE id = ?`).bind(id).run();
    return json({ success: true });
  } catch (err) {
    return json({ error: 'Failed to delete staff', details: err.message }, 500);
  }
}
