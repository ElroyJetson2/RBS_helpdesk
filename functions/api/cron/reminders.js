import { notifyReminder } from '../../lib/email.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || request.headers.get('x-cron-key');
  const expected = env.CRON_SECRET || 'elite-cron-secret';
  if (key !== expected) return json({ error: 'Unauthorized' }, 401);

  try {
    const rows = await env.DB.prepare(`
      SELECT i.*, d.name AS development_name
      FROM incidents i
      JOIN developments d ON d.id = i.development_id
      WHERE i.status = 'open'
        AND (
          (i.last_reminder_at IS NULL AND datetime(i.created_at) <= datetime('now', '-7 days'))
          OR (i.last_reminder_at IS NOT NULL AND datetime(i.last_reminder_at) <= datetime('now', '-7 days'))
        )
    `).all();

    const list = rows.results || [];
    let sent = 0;
    for (const inc of list) {
      await notifyReminder(env, inc);
      await env.DB.prepare(
        `UPDATE incidents SET last_reminder_at = datetime('now') WHERE id = ?`
      ).bind(inc.id).run();
      sent++;
    }
    return json({ success: true, reminded: sent, checked: list.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
