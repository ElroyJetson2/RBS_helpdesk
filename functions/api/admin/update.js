import { notifyStatusChange } from '../../lib/email.js';

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

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = checkAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const reference = (body.reference || '').trim().toUpperCase();
    const status = body.status;
    const note = (body.note || '').trim();

    if (!reference) return json({ error: 'Reference required' }, 400);
    if (status && !['open', 'closed'].includes(status)) {
      return json({ error: 'Status must be open or closed' }, 400);
    }

    const incident = await env.DB.prepare(
      `SELECT i.*, d.name AS development_name FROM incidents i
       JOIN developments d ON d.id = i.development_id WHERE i.reference = ?`
    ).bind(reference).first();

    if (!incident) return json({ error: 'Incident not found' }, 404);

    const newStatus = status || incident.status;
    const statusChanged = newStatus !== incident.status;

    await env.DB.prepare(
      `UPDATE incidents SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newStatus, incident.id).run();

    const updateNote = note || (statusChanged ? `Status changed to ${newStatus}` : 'Update added');
    await env.DB.prepare(
      `INSERT INTO updates (incident_id, status, note, created_by) VALUES (?, ?, ?, 'staff')`
    ).bind(incident.id, newStatus, updateNote).run();

    const updated = { ...incident, status: newStatus };
    if (statusChanged || note) {
      context.waitUntil(notifyStatusChange(env, updated, updateNote));
    }

    return json({ success: true, status: newStatus });
  } catch (err) {
    return json({ error: 'Update failed', details: err.message }, 500);
  }
}
