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

  const url = new URL(request.url);
  const developmentId = url.searchParams.get('development_id');
  const status = url.searchParams.get('status');
  const q = (url.searchParams.get('q') || '').trim();
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);
  const includeStats = url.searchParams.get('stats') === '1';

  try {
    let query = `
      SELECT
        i.id, i.reference, i.unit, i.reporter_name, i.reporter_contact,
        i.description, i.status, i.created_at, i.updated_at,
        d.id AS development_id, d.name AS development_name, d.code AS development_code,
        d.formatted_address AS development_address,
        (SELECT note FROM updates u WHERE u.incident_id = i.id ORDER BY u.created_at DESC LIMIT 1) AS latest_note,
        (SELECT COUNT(*) FROM photos p WHERE p.incident_id = i.id) AS photo_count,
        (SELECT COUNT(*) FROM updates u WHERE u.incident_id = i.id) AS update_count
      FROM incidents i
      JOIN developments d ON d.id = i.development_id
      WHERE 1=1
    `;
    const params = [];

    if (developmentId) {
      query += ' AND i.development_id = ?';
      params.push(developmentId);
    }
    if (status && (status === 'open' || status === 'closed')) {
      query += ' AND i.status = ?';
      params.push(status);
    }
    if (dateFrom) {
      query += ' AND date(i.created_at) >= date(?)';
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ' AND date(i.created_at) <= date(?)';
      params.push(dateTo);
    }
    if (q) {
      query += ` AND (
        i.reference LIKE ? OR
        i.reporter_name LIKE ? OR
        i.reporter_contact LIKE ? OR
        i.description LIKE ? OR
        d.name LIKE ? OR
        d.formatted_address LIKE ? OR
        d.address LIKE ?
      )`;
      const like = '%' + q + '%';
      params.push(like, like, like, like, like, like, like);
    }

    query += ' ORDER BY i.created_at DESC LIMIT ?';
    params.push(limit);

    const result = await env.DB.prepare(query).bind(...params).all();
    const developments = await env.DB.prepare(
      'SELECT id, name, code FROM developments ORDER BY name'
    ).all();

    let stats = null;
    if (includeStats) {
      const open = await env.DB.prepare("SELECT COUNT(*) AS c FROM incidents WHERE status = 'open'").first();
      const closed = await env.DB.prepare("SELECT COUNT(*) AS c FROM incidents WHERE status = 'closed'").first();
      const today = await env.DB.prepare("SELECT COUNT(*) AS c FROM incidents WHERE date(created_at) = date('now')").first();
      const week = await env.DB.prepare("SELECT COUNT(*) AS c FROM incidents WHERE date(created_at) >= date('now', '-7 days')").first();
      const closedWeek = await env.DB.prepare("SELECT COUNT(*) AS c FROM incidents WHERE status = 'closed' AND date(updated_at) >= date('now', '-7 days')").first();
      stats = {
        open: open?.c || 0,
        closed: closed?.c || 0,
        total: (open?.c || 0) + (closed?.c || 0),
        today: today?.c || 0,
        week: week?.c || 0,
        closed_week: closedWeek?.c || 0
      };
    }

    return json({
      success: true,
      incidents: result.results || [],
      developments: developments.results || [],
      stats
    });
  } catch (err) {
    return json({ error: 'Failed to list incidents', details: err.message }, 500);
  }
}
