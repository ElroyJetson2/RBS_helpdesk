import { notifyNewJob } from '../lib/email.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function genRef() {
  const d = new Date();
  const y = String(d.getUTCFullYear()).slice(-2);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `RBS-${y}${m}${day}-${suffix}`;
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());
}

function isValidPhone(s) {
  return (s || '').replace(/\D/g, '').length === 10;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function readPhotos(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const fields = {
      place_id: form.get('place_id') || '',
      formatted_address: form.get('formatted_address') || '',
      address_name: form.get('address_name') || '',
      lat: form.get('lat') || '',
      lng: form.get('lng') || '',
      reporter_name: form.get('reporter_name'),
      reporter_phone: form.get('reporter_phone'),
      reporter_email: form.get('reporter_email'),
      description: form.get('description'),
    };
    const photos = [];
    for (const [key, val] of form.entries()) {
      if (key === 'photos' && val && typeof val.arrayBuffer === 'function') {
        const buf = await val.arrayBuffer();
        if (buf.byteLength > 1.5 * 1024 * 1024 || buf.byteLength < 100) continue;
        const mime = val.type || 'image/jpeg';
        if (!mime.startsWith('image/')) continue;
        photos.push(`data:${mime};base64,${arrayBufferToBase64(buf)}`);
        if (photos.length >= 5) break;
      }
    }
    return { fields, photos };
  }
  const body = await request.json();
  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 5) : [];
  return {
    fields: body,
    photos: photos.filter((p) => typeof p === 'string' && p.startsWith('data:image/')),
  };
}

async function upsertDevelopment(env, fields) {
  const placeId = (fields.place_id || '').toString().trim();
  const formatted = (fields.formatted_address || fields.address_name || '').toString().trim();
  const name = (fields.address_name || formatted).toString().trim().slice(0, 120);
  const lat = fields.lat === '' || fields.lat == null ? null : Number(fields.lat);
  const lng = fields.lng === '' || fields.lng == null ? null : Number(fields.lng);

  if (!formatted) throw new Error('Please choose an address from the suggestions.');

  if (placeId) {
    const existing = await env.DB.prepare(
      'SELECT id FROM developments WHERE place_id = ?'
    )
      .bind(placeId)
      .first();
    if (existing) return existing.id;
  }

  const byName = await env.DB.prepare(
    'SELECT id FROM developments WHERE name = ? OR formatted_address = ?'
  )
    .bind(name, formatted)
    .first();
  if (byName) return byName.id;

  const code = 'A' + Math.random().toString(36).slice(2, 8).toUpperCase();
  await env.DB.prepare(
    `INSERT INTO developments (name, code, address, place_id, formatted_address, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(name, code, formatted, placeId || null, formatted, lat, lng)
    .run();

  const row = await env.DB.prepare(
    'SELECT id FROM developments WHERE place_id = ? OR formatted_address = ? ORDER BY id DESC LIMIT 1'
  )
    .bind(placeId || '', formatted)
    .first();
  if (!row) throw new Error('Could not save address');
  return row.id;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { fields, photos } = await readPhotos(request);
    const reporter_name = (fields.reporter_name || '').toString().trim();
    const reporter_phone = (fields.reporter_phone || '').toString().trim();
    const reporter_email = (fields.reporter_email || '').toString().trim();
    const description = (fields.description || '').toString().trim();

    if (!reporter_name || !reporter_phone || !reporter_email || !description) {
      return json({ error: 'Please fill in all required fields' }, 400);
    }
    if (!isValidPhone(reporter_phone)) {
      return json({ error: 'Please enter a valid 10-digit phone number' }, 400);
    }
    if (!isValidEmail(reporter_email)) {
      return json({ error: 'Please enter a valid email address' }, 400);
    }

    const development_id = await upsertDevelopment(env, fields);
    const reporter_contact = `${reporter_phone} | ${reporter_email}`;
    const reference = genRef();

    await env.DB.prepare(
      `INSERT INTO incidents (reference, development_id, unit, reporter_name, reporter_contact, description, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`
    )
      .bind(reference, development_id, '', reporter_name, reporter_contact, description)
      .run();

    const row = await env.DB.prepare('SELECT id FROM incidents WHERE reference = ?')
      .bind(reference)
      .first();
    const incidentId = row.id;

    await env.DB.prepare(
      `INSERT INTO updates (incident_id, status, note, created_by) VALUES (?, 'open', 'Incident logged by customer', 'customer')`
    )
      .bind(incidentId)
      .run();

    for (const dataUrl of photos) {
      if (dataUrl.length > 2_000_000) continue;
      await env.DB.prepare(`INSERT INTO photos (incident_id, data_url) VALUES (?, ?)`)
        .bind(incidentId, dataUrl)
        .run();
    }

    const full = await env.DB.prepare(
      `SELECT i.*, d.name AS development_name FROM incidents i
       JOIN developments d ON d.id = i.development_id WHERE i.reference = ?`
    )
      .bind(reference)
      .first();

    let email = { ok: false, reason: 'not attempted' };
    try {
      email = await notifyNewJob(env, full);
    } catch (e) {
      email = { ok: false, error: String(e) };
    }

    return json({
      success: true,
      reference,
      track_url: `/track.html?ref=${encodeURIComponent(reference)}`,
      email,
    });
  } catch (err) {
    console.error('report error', err);
    return json({ error: err.message || 'Failed to create incident', details: err.message }, 500);
  }
}
