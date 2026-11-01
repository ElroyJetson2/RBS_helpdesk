/**
 * GET /api/admin/abn?abn=51824753556
 * Looks up Australian Business Register (ABR) entity name.
 * Requires ABR_GUID in Cloudflare Pages env (free from abr.business.gov.au).
 */
import { json, getStaffFromRequest } from '../../lib/auth.js';

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function validateAbnChecksum(abn) {
  if (!/^\d{11}$/.test(abn)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const d = abn.split('').map(Number);
  d[0] -= 1;
  const sum = d.reduce((acc, n, i) => acc + n * weights[i], 0);
  return sum % 89 === 0;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const me = await getStaffFromRequest(env, request);
  if (!me) return json({ error: 'Unauthorized' }, 401);
  if (me.role !== 'admin') return json({ error: 'Admin only' }, 403);

  try {
    const abn = digitsOnly(new URL(request.url).searchParams.get('abn'));
    if (abn.length !== 11) {
      return json({ error: 'ABN must be 11 digits' }, 400);
    }
    if (!validateAbnChecksum(abn)) {
      return json({ error: 'Invalid ABN checksum' }, 400);
    }

    const guid = (env.ABR_GUID || '').trim();
    if (!guid) {
      return json({
        error: 'ABN lookup not configured. Add ABR_GUID in Cloudflare Pages environment variables.',
        hint: 'Register free at https://abr.business.gov.au/Tools/WebServices'
      }, 503);
    }

    const url =
      'https://abr.business.gov.au/json/AbnDetails.aspx?' +
      new URLSearchParams({ abn, guid, callback: 'callback' });

    const res = await fetch(url, {
      headers: { Accept: 'application/json, text/javascript, */*' }
    });
    if (!res.ok) {
      return json({ error: 'ABR request failed', status: res.status }, 502);
    }

    let text = await res.text();
    text = text.trim();
    if (text.startsWith('callback(') && text.endsWith(')')) {
      text = text.slice(9, -1);
    } else if (text.startsWith('callback(') && text.endsWith(');')) {
      text = text.slice(9, -2);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return json({ error: 'Could not parse ABR response' }, 502);
    }

    const entityName =
      data.EntityName ||
      (Array.isArray(data.BusinessName) ? data.BusinessName[0] : null) ||
      null;

    const status = data.EntityStatusCode || data.AbnStatus || data.Message || '';
    if (data.Message && !entityName) {
      return json({ error: data.Message, success: false }, 404);
    }

    return json({
      success: true,
      abn,
      entity_name: entityName || null,
      entity_type: data.EntityTypeName || data.EntityTypeCode || null,
      status: status || null,
      gst: data.Gst || null
    });
  } catch (err) {
    console.error('ABN lookup', err);
    return json({ error: 'ABN lookup failed', details: String(err.message || err) }, 500);
  }
}
