import { notifyNewJob } from '../lib/email.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
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
  return `GC-${y}${m}${day}-${suffix}`;
}

function isValidContact(s) {
  const t = (s || '').trim();
  if (!t) return false;
  if (t.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  const digits = t.replace(/\D/g, '');
  return digits.length === 10;
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
      development_id: form.get('development_id'),
      unit: form.get('unit') || '',
      reporter_name: form.get('reporter_name'),
      reporter_contact: form.get('reporter_contact'),
      description: form.get('description')
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
    photos: photos.filter(p => typeof p === 'string' && p.startsWith('data:image/'))
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { fields, photos } = await readPhotos(request);
    const development_id = parseInt(fields.development_id, 10);
    const unit = (fields.unit || '').toString().trim();
    const reporter_name = (fields.reporter_name || '').toString().trim();
    const reporter_contact = (fields.reporter_contact || '').toString().trim();
    const description = (fields.description || '').toString().trim();

    if (!development_id || !reporter_name || !reporter_contact || !description) {
      return json({ error: 'Please fill in all required fields' }, 400);
    }
    if (!isValidContact(reporter_contact)) {
      return json({ error: 'Please enter a 10-digit phone number or a valid email address' }, 400);
    }

    const reference = genRef();

    await env.DB.prepare(
      `INSERT INTO incidents (reference, development_id, unit, reporter_name, reporter_contact, description, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`
    ).bind(reference, development_id, unit, reporter_name, reporter_contact, description).run();

    const row = await env.DB.prepare('SELECT id FROM incidents WHERE reference = ?').bind(reference).first();
    const incidentId = row.id;

    await env.DB.prepare(
      `INSERT INTO updates (incident_id, status, note, created_by) VALUES (?, 'open', 'Incident logged by customer', 'customer')`
    ).bind(incidentId).run();

    for (const dataUrl of photos) {
      if (dataUrl.length > 2_000_000) continue;
      await env.DB.prepare(`INSERT INTO photos (incident_id, data_url) VALUES (?, ?)`).bind(incidentId, dataUrl).run();
    }

    const full = await env.DB.prepare(
      `SELECT i.*, d.name AS development_name FROM incidents i
       JOIN developments d ON d.id = i.development_id WHERE i.reference = ?`
    ).bind(reference).first();

    // Await email so we know if staff notification worked (do not fail the job if email fails)
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
      email
    });
  } catch (err) {
    console.error('report error', err);
    return json({ error: 'Failed to create incident', details: err.message }, 500);
  }
}
