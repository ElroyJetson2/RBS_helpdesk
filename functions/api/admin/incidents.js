import { json, getStaffFromRequest, VALID_STATUSES } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const staff = await getStaffFromRequest(env, request);
  if (!staff) return json({ error: 'Unauthorized' }, 401);

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
        i.description, i.status, i.assigned_to, i.created_at, i.updated_at,
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

    if (staff.role === 'contractor') {
      query += ' AND (i.assigned_to = ? OR i.assigned_to = ?)';
      params.push(staff.display_name, staff.username);
    }

    if (developmentId) {
      query += ' AND i.development_id = ?';
      params.push(developmentId);
    }
    if (status && VALID_STATUSES.includes(status)) {
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
        i.reference LIKE ? OR i.reporter_name LIKE ? OR i.reporter_contact LIKE ?
        OR i.description LIKE ? OR d.name LIKE ? OR d.formatted_address LIKE ?
        OR i.assigned_to LIKE ?
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

    const assignees = await env.DB.prepare(
      `SELECT id, username, display_name, email, role FROM staff
       WHERE role = 'contractor' OR role = 'admin'
       ORDER BY display_name`
    ).all();

    let stats = null;
    if (includeStats) {
      let baseWhere = '1=1';
      const sParams = [];
      if (staff.role === 'contractor') {
        baseWhere = '(assigned_to = ? OR assigned_to = ?)';
        sParams.push(staff.display_name, staff.username);
      }
      const open = await env.DB.prepare(`SELECT COUNT(*) AS c FROM incidents WHERE status = 'open' AND ${baseWhere}`).bind(...sParams).first();
      const assigned = await env.DB.prepare(`SELECT COUNT(*) AS c FROM incidents WHERE status = 'assigned' AND ${baseWhere}`).bind(...sParams).first();
      const inProg = await env.DB.prepare(`SELECT COUNT(*) AS c FROM incidents WHERE status = 'in_progress' AND ${baseWhere}`).bind(...sParams).first();
      const signOff = await env.DB.prepare(`SELECT COUNT(*) AS c FROM incidents WHERE status = 'customer_sign_off' AND ${baseWhere}`).bind(...sParams).first();
      const closed = await env.DB.prepare(`SELECT COUNT(*) AS c FROM incidents WHERE status = 'closed' AND ${baseWhere}`).bind(...sParams).first();
      const today = await env.DB.prepare(`SELECT COUNT(*) AS c FROM incidents WHERE date(created_at) = date('now') AND ${baseWhere}`).bind(...sParams).first();
      stats = {
        open: open?.c || 0,
        assigned: assigned?.c || 0,
        in_progress: inProg?.c || 0,
        customer_sign_off: signOff?.c || 0,
        closed: closed?.c || 0,
        today: today?.c || 0,
        total: (open?.c || 0) + (assigned?.c || 0) + (inProg?.c || 0) + (signOff?.c || 0) + (closed?.c || 0)
      };
    }

    return json({
      success: true,
      incidents: result.results || [],
      developments: developments.results || [],
      assignees: (assignees.results || []).map(a => ({
        id: a.id,
        username: a.username,
        display_name: a.display_name || a.username,
        email: a.email,
        role: a.role
      })),
      stats,
      role: staff.role,
      me: { username: staff.username, display_name: staff.display_name }
    });
  } catch (err) {
    return json({ error: 'Failed to list incidents', details: err.message }, 500);
  }
}
