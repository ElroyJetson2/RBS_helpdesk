import { json, getStaffFromRequest } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const me = await getStaffFromRequest(env, request);
  if (!me) return json({ error: 'Unauthorized' }, 401);
  if (me.role !== 'admin') return json({ error: 'Admin only' }, 403);

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const row = await env.DB.prepare(`SELECT * FROM contractors WHERE id = ?`).bind(id).first();
      if (!row) return json({ error: 'Not found' }, 404);
      const full = new URL(request.url).searchParams.get('full') === '1';
      let documents;
      if (full) {
        const fullDocs = await env.DB.prepare(
          `SELECT id, doc_type, file_name, data_url, created_at FROM contractor_documents WHERE contractor_id = ? ORDER BY id`
        ).bind(id).all();
        documents = fullDocs.results || [];
      } else {
        const docs = await env.DB.prepare(
          `SELECT id, doc_type, file_name, created_at FROM contractor_documents WHERE contractor_id = ? ORDER BY id`
        ).bind(id).all();
        documents = docs.results || [];
      }
      return json({ success: true, contractor: row, documents });
    }

    const rows = await env.DB.prepare(
      `SELECT id, business_name, trading_name, abn, contact_name, phone, email,
              licence_type, licence_number, active, staff_username, created_at
       FROM contractors ORDER BY business_name`
    ).all();
    return json({ success: true, contractors: rows.results || [] });
  } catch (err) {
    return json({ error: 'Failed to load contractors', details: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const me = await getStaffFromRequest(env, request);
  if (!me) return json({ error: 'Unauthorized' }, 401);
  if (me.role !== 'admin') return json({ error: 'Admin only' }, 403);

  try {
    const body = await request.json();
    const business_name = (body.business_name || '').trim();
    const contact_name = (body.contact_name || '').trim();
    const phone = (body.phone || '').trim();
    const email = (body.email || '').trim();
    if (!business_name || !contact_name) {
      return json({ error: 'Business name and contact name are required' }, 400);
    }
    if (!phone) {
      return json({ error: 'Phone is required' }, 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'A valid email is required' }, 400);
    }

    const fields = pickFields(body);
    const result = await env.DB.prepare(
      `INSERT INTO contractors (
        business_name, trading_name, abn, address, contact_name, phone, email,
        licence_type, licence_number, licence_expiry,
        insurance_provider, insurance_policy, insurance_expiry,
        bank_account_name, bank_bsb, bank_account_number,
        notes, staff_username, active
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      fields.business_name, fields.trading_name, fields.abn, fields.address,
      fields.contact_name, fields.phone, fields.email,
      fields.licence_type, fields.licence_number, fields.licence_expiry,
      fields.insurance_provider, fields.insurance_policy, fields.insurance_expiry,
      fields.bank_account_name, fields.bank_bsb, fields.bank_account_number,
      fields.notes, fields.staff_username, fields.active
    ).run();

    const contractorId = result.meta?.last_row_id;

    if (body.create_login && body.login_username && body.login_password) {
      const username = String(body.login_username).trim().toLowerCase().replace(/\s+/g, '');
      const password = String(body.login_password).trim();
      try {
        await env.DB.prepare(
          `INSERT INTO staff (username, password_hash, display_name, role, email) VALUES (?, ?, ?, 'contractor', ?)`
        ).bind(username, password, contact_name || business_name, fields.email || null).run();
        await env.DB.prepare(`UPDATE contractors SET staff_username = ? WHERE id = ?`).bind(username, contractorId).run();
      } catch (e) {
        return json({
          success: true,
          id: contractorId,
          warning: 'Contractor saved but login not created: ' + (e.message || String(e))
        });
      }
    }

    if (Array.isArray(body.documents) && contractorId) {
      for (const d of body.documents.slice(0, 10)) {
        if (!d.data_url) continue;
        await env.DB.prepare(
          `INSERT INTO contractor_documents (contractor_id, doc_type, file_name, data_url) VALUES (?, ?, ?, ?)`
        ).bind(contractorId, d.doc_type || 'other', d.file_name || null, d.data_url).run();
      }
    }

    return json({ success: true, id: contractorId });
  } catch (err) {
    return json({ error: 'Failed to create contractor', details: err.message }, 500);
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
    const f = pickFields(body);
    await env.DB.prepare(
      `UPDATE contractors SET
        business_name=?, trading_name=?, abn=?, address=?, contact_name=?, phone=?, email=?,
        licence_type=?, licence_number=?, licence_expiry=?,
        insurance_provider=?, insurance_policy=?, insurance_expiry=?,
        bank_account_name=?, bank_bsb=?, bank_account_number=?,
        notes=?, staff_username=?, active=?, updated_at=datetime('now')
       WHERE id=?`
    ).bind(
      f.business_name, f.trading_name, f.abn, f.address, f.contact_name, f.phone, f.email,
      f.licence_type, f.licence_number, f.licence_expiry,
      f.insurance_provider, f.insurance_policy, f.insurance_expiry,
      f.bank_account_name, f.bank_bsb, f.bank_account_number,
      f.notes, f.staff_username, f.active, id
    ).run();

    if (Array.isArray(body.documents)) {
      for (const d of body.documents.slice(0, 10)) {
        if (!d.data_url) continue;
        await env.DB.prepare(
          `INSERT INTO contractor_documents (contractor_id, doc_type, file_name, data_url) VALUES (?, ?, ?, ?)`
        ).bind(id, d.doc_type || 'other', d.file_name || null, d.data_url).run();
      }
    }
    return json({ success: true });
  } catch (err) {
    return json({ error: 'Failed to update contractor', details: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const me = await getStaffFromRequest(env, request);
  if (!me) return json({ error: 'Unauthorized' }, 401);
  if (me.role !== 'admin') return json({ error: 'Admin only' }, 403);
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const docId = url.searchParams.get('doc_id');
    if (docId) {
      await env.DB.prepare(`DELETE FROM contractor_documents WHERE id = ?`).bind(docId).run();
      return json({ success: true });
    }
    if (!id) return json({ error: 'ID required' }, 400);
    await env.DB.prepare(`DELETE FROM contractor_documents WHERE contractor_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM contractors WHERE id = ?`).bind(id).run();
    return json({ success: true });
  } catch (err) {
    return json({ error: 'Failed to delete', details: err.message }, 500);
  }
}

function pickFields(body) {
  const s = (k) => {
    const v = body[k];
    if (v === undefined || v === null) return null;
    const t = String(v).trim();
    return t === '' ? null : t;
  };
  return {
    business_name: s('business_name') || '',
    trading_name: s('trading_name'),
    abn: s('abn'),
    address: s('address'),
    contact_name: s('contact_name') || '',
    phone: s('phone'),
    email: s('email'),
    licence_type: s('licence_type'),
    licence_number: s('licence_number'),
    licence_expiry: s('licence_expiry'),
    insurance_provider: s('insurance_provider'),
    insurance_policy: s('insurance_policy'),
    insurance_expiry: s('insurance_expiry'),
    bank_account_name: s('bank_account_name'),
    bank_bsb: s('bank_bsb'),
    bank_account_number: s('bank_account_number'),
    notes: s('notes'),
    staff_username: s('staff_username'),
    active: body.active === 0 || body.active === false || body.active === '0' ? 0 : 1
  };
}
