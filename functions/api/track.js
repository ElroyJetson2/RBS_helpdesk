function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const ref = new URL(request.url).searchParams.get('ref');
  if (!ref) return json({ error: 'Reference required' }, 400);

  try {
    const incident = await env.DB.prepare(
      `SELECT i.*, d.name AS development_name, d.code AS development_code, d.address AS development_address
       FROM incidents i JOIN developments d ON d.id = i.development_id
       WHERE i.reference = ?`
    ).bind(ref.trim().toUpperCase()).first();

    if (!incident) return json({ error: 'Incident not found' }, 404);

    const updates = await env.DB.prepare(
      `SELECT status, note, created_by, created_at FROM updates WHERE incident_id = ? ORDER BY created_at ASC`
    ).bind(incident.id).all();

    const photos = await env.DB.prepare(
      `SELECT id, data_url, created_at FROM photos WHERE incident_id = ? ORDER BY id ASC`
    ).bind(incident.id).all();

    return json({
      success: true,
      incident: {
        reference: incident.reference,
        development_name: incident.development_name,
        unit: incident.unit,
        reporter_name: incident.reporter_name,
        description: incident.description,
        status: incident.status,
        created_at: incident.created_at,
        updated_at: incident.updated_at
      },
      updates: updates.results || [],
      photos: (photos.results || []).map(p => ({ id: p.id, data_url: p.data_url }))
    });
  } catch (err) {
    return json({ error: 'Failed to fetch incident', details: err.message }, 500);
  }
}
