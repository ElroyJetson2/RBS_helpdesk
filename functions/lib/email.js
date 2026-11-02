/**
 * RBS Helpdesk email helpers (Resend).
 * Staff inbox: STAFF_EMAIL or helpdesk@requirebuilding.com.au
 */
const STAFF_EMAIL = 'helpdesk@requirebuilding.com.au';
const SITE = 'https://rbs-helpdesk.pages.dev';

export function staffEmail(env) {
  return (env.STAFF_EMAIL || STAFF_EMAIL).trim().toLowerCase();
}

export function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/**
 * @param {object} opts
 * @param {string|string[]} opts.to
 * @param {string|string[]} [opts.cc]
 * @param {string} opts.subject
 * @param {string} opts.text
 * @param {string} [opts.html]
 * @param {{filename:string, content:string, contentType?:string}[]} [opts.attachments] content = base64
 */
export async function sendEmail(env, { to, cc, subject, text, html, attachments }) {
  const key = env.RESEND_API_KEY;
  if (!key) {
    console.log('[email skipped – no RESEND_API_KEY]', { to, subject });
    return { ok: false, skipped: true, reason: 'RESEND_API_KEY not set' };
  }
  const from = env.EMAIL_FROM || 'RBS Helpdesk <onboarding@resend.dev>';
  const recipients = (Array.isArray(to) ? to : [to]).map((a) => String(a).trim().toLowerCase()).filter(Boolean);
  const ccList = cc
    ? (Array.isArray(cc) ? cc : [cc]).map((a) => String(a).trim().toLowerCase()).filter(Boolean)
    : [];

  const payload = {
    from,
    to: recipients,
    subject,
    text,
    html: html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`
  };
  if (ccList.length) payload.cc = ccList;
  if (attachments && attachments.length) {
    payload.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      content_type: a.contentType || 'application/pdf'
    }));
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Resend error', res.status, body);
      return { ok: false, error: body };
    }
    return { ok: true, id: body.id };
  } catch (err) {
    console.error('sendEmail failed', err);
    return { ok: false, error: String(err) };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jobUrl(reference) {
  return `${SITE}/track.html?ref=${encodeURIComponent(reference)}`;
}

function buttonHtml(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#0B1426;color:#C9A962;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;border:1px solid #C9A962;">${label}</a>`;
}

function emailShell(inner) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F7F4EF;font-family:system-ui,-apple-system,sans-serif;color:#0B1426;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e8e4dc;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.12em;color:#888;">REQUIRE BUILDING SOLUTIONS</p>
    <p style="margin:0 0 20px;font-size:11px;color:#aaa;">RBS Helpdesk</p>
    ${inner}
    <p style="margin:28px 0 0;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:14px;">This message was sent by RBS Helpdesk. Please action assigned jobs within 7 days unless otherwise agreed.</p>
  </div>
</body></html>`;
}

function formatAuDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'Z');
    return d.toLocaleString('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(iso);
  }
}

function actionByDate(fromIso) {
  try {
    const d = new Date(fromIso && fromIso.includes('T') ? fromIso : (fromIso || Date.now()) + (fromIso ? 'Z' : ''));
    if (Number.isNaN(d.getTime())) d.setTime(Date.now());
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString('en-AU', {
      timeZone: 'Australia/Brisbane',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'within 7 days';
  }
}

/** Minimal single-page text PDF (PDF 1.4) as base64 */
function buildJobPdfBase64({ reference, property, assignee, status, reporter, contact, description, createdAt, assignedAt, actionBy, photoCount }) {
  const lines = [
    'REQUIRE BUILDING SOLUTIONS — JOB ALLOCATION REPORT',
    '================================================',
    '',
    `Reference:     ${reference}`,
    `Status:        ${status}`,
    `Assigned to:   ${assignee}`,
    `Property:      ${property || '—'}`,
    `Reporter:      ${reporter || '—'}`,
    `Contact:       ${contact || '—'}`,
    `Logged:        ${createdAt}`,
    `Assigned:      ${assignedAt}`,
    `Action by:     ${actionBy}  (within 7 days)`,
    `Photos:        ${photoCount} attached in email`,
    '',
    'DESCRIPTION',
    '-----------',
    ...(description || '—').split(/\r?\n/).flatMap((line) => wrapText(line, 90)),
    '',
    '------------------------------------------------',
    'Please action this job within 7 days of the assignment date.',
    'Reply to this email or update the job in the staff portal.',
    `Track online: ${SITE}/track.html?ref=${reference}`,
    '',
    'CC: helpdesk@requirebuilding.com.au'
  ];

  const contentLines = ['BT', '/F1 10 Tf', '50 780 Td', '14 TL'];
  let first = true;
  for (const line of lines) {
    const safe = pdfEscape(line);
    if (first) {
      contentLines.push(`(${safe}) Tj`);
      first = false;
    } else {
      contentLines.push('T*');
      contentLines.push(`(${safe}) Tj`);
    }
  }
  contentLines.push('ET');
  const stream = contentLines.join('\n');
  const streamLen = byteLength(stream);

  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
  );
  objects.push(`4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`);
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(byteLength(pdf));
    pdf += obj;
  }
  const xrefStart = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return base64Encode(pdf);
}

function wrapText(text, width) {
  const words = String(text).split(/\s+/);
  const out = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if ((line + ' ' + w).length <= width) line += ' ' + w;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

function pdfEscape(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?');
}

function byteLength(str) {
  return str.length;
}

function base64Encode(str) {
  if (typeof btoa === 'function') {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  return Buffer.from(str, 'binary').toString('base64');
}

export async function notifyNewJob(env, incident) {
  const staff = staffEmail(env);
  const ref = incident.reference;
  const track = jobUrl(ref);
  const subject = `[New] ${ref} — ${incident.development_name || 'Job'}`;

  const text = [
    `New incident ${ref}`,
    `Property: ${incident.development_name || '—'}`,
    `Reporter: ${incident.reporter_name} · ${incident.reporter_contact}`,
    '',
    incident.description || '',
    '',
    `Open: ${track}`
  ].join('\n');

  const html = emailShell(`
    <h1 style="margin:8px 0 16px;font-size:22px;font-weight:600;">New incident logged</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">A customer has submitted a maintenance request.</p>
    <p style="margin:0 0 20px;">${buttonHtml(track, 'Open this job')}</p>
    <table style="width:100%;font-size:14px;line-height:1.6;border-collapse:collapse;">
      <tr><td style="padding:4px 0;color:#888;width:110px;">Reference</td><td style="padding:4px 0;font-weight:600;font-family:monospace;">${escapeHtml(ref)}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Property</td><td style="padding:4px 0;">${escapeHtml(incident.development_name || '—')}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Reporter</td><td style="padding:4px 0;">${escapeHtml(incident.reporter_name)}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Contact</td><td style="padding:4px 0;">${escapeHtml(incident.reporter_contact)}</td></tr>
    </table>
    <p style="margin:16px 0 4px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Description</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(incident.description || '')}</p>
  `);

  return sendEmail(env, { to: staff, subject, text, html });
}

export async function notifyStatusChange(env, incident, note) {
  const staff = staffEmail(env);
  const ref = incident.reference;
  const track = jobUrl(ref);
  const subject = `[${incident.status === 'closed' ? 'Closed' : 'Update'}] ${ref}`;

  const text = [
    `Job ${ref} is now: ${String(incident.status || '').toUpperCase()}`,
    '',
    `Property: ${incident.development_name || '—'}`,
    note ? `Note: ${note}` : '',
    '',
    `Open this job: ${track}`
  ].filter(Boolean).join('\n');

  const html = emailShell(`
    <h1 style="margin:8px 0 16px;font-size:22px;font-weight:600;">Job ${escapeHtml(incident.status)}</h1>
    <p style="margin:0 0 16px;font-size:15px;">Reference <strong style="font-family:monospace;">${escapeHtml(ref)}</strong> is now <strong>${escapeHtml(String(incident.status || '').toUpperCase())}</strong>.</p>
    <p style="margin:0 0 20px;">${buttonHtml(track, 'Open this job')}</p>
    ${note ? `<p style="margin:0 0 16px;font-size:14px;"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ''}
  `);

  return sendEmail(env, { to: staff, subject, text, html });
}

export async function notifyReminder(env, incident) {
  const staff = staffEmail(env);
  const ref = incident.reference;
  const subject = `[Reminder] Open job ${ref}`;
  const text = `Reminder: job ${ref} is still open.\n${jobUrl(ref)}`;
  const html = emailShell(`<h1 style="font-size:20px;">Open job reminder</h1>
    <p>Reference <strong style="font-family:monospace;">${escapeHtml(ref)}</strong> is still open.</p>
    <p>${buttonHtml(jobUrl(ref), 'Open this job')}</p>`);
  return sendEmail(env, { to: staff, subject, text, html });
}

/**
 * When a job is assigned: PDF report + photos to contractor, CC helpdesk.
 * Action required within 7 days.
 */
export async function notifyAssignment(env, incident, assigneeName) {
  const staffInbox = staffEmail(env);
  const ref = incident.reference;
  const track = jobUrl(ref);
  const admin = `${SITE}/admin.html`;
  const assignedAt = new Date().toISOString();
  const actionBy = actionByDate(assignedAt);
  const loggedAt = formatAuDate(incident.created_at);
  const assignedAtFmt = formatAuDate(assignedAt);

  let assigneeEmail = null;
  try {
    const row = await env.DB.prepare(
      `SELECT email FROM staff WHERE lower(display_name) = lower(?) OR lower(username) = lower(?) LIMIT 1`
    )
      .bind(assigneeName, assigneeName)
      .first();
    if (row?.email && isEmail(row.email)) assigneeEmail = row.email.trim();
  } catch (e) {}
  if (!assigneeEmail) {
    try {
      const row = await env.DB.prepare(
        `SELECT email FROM contractors WHERE lower(contact_name) = lower(?) OR lower(business_name) = lower(?) OR lower(staff_username) = lower(?) LIMIT 1`
      )
        .bind(assigneeName, assigneeName, assigneeName)
        .first();
      if (row?.email && isEmail(row.email)) assigneeEmail = row.email.trim();
    } catch (e) {}
  }

  let photos = [];
  try {
    const id = incident.id;
    if (id) {
      const res = await env.DB.prepare(
        `SELECT id, data_url FROM photos WHERE incident_id = ? ORDER BY id ASC LIMIT 5`
      )
        .bind(id)
        .all();
      photos = res.results || [];
    }
  } catch (e) {
    console.error('photo load failed', e);
  }

  const pdfBase64 = buildJobPdfBase64({
    reference: ref,
    property: incident.development_name || incident.development_address || '',
    assignee: assigneeName,
    status: incident.status || 'assigned',
    reporter: incident.reporter_name,
    contact: incident.reporter_contact,
    description: incident.description,
    createdAt: loggedAt,
    assignedAt: assignedAtFmt,
    actionBy,
    photoCount: photos.length
  });

  const attachments = [
    {
      filename: `${ref}-job-allocation.pdf`,
      content: pdfBase64,
      contentType: 'application/pdf'
    }
  ];

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const dataUrl = p.data_url || '';
    const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
    if (!m) continue;
    const mime = m[1] || 'image/jpeg';
    const b64 = m[2];
    if (b64.length > 5500000) continue;
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    attachments.push({
      filename: `${ref}-photo-${i + 1}.${ext}`,
      content: b64,
      contentType: mime
    });
  }

  const subject = `[Assigned] ${ref} → ${assigneeName} — action within 7 days`;
  const text = [
    `JOB ALLOCATION — ${ref}`,
    '',
    `Assigned to: ${assigneeName}`,
    `Property: ${incident.development_name || '—'}`,
    `Status: ${incident.status}`,
    `Logged: ${loggedAt}`,
    `Assigned: ${assignedAtFmt}`,
    `ACTION BY: ${actionBy} (within 7 days of assignment)`,
    '',
    `Reporter: ${incident.reporter_name} · ${incident.reporter_contact}`,
    '',
    'Description:',
    incident.description || '',
    '',
    `Photos attached: ${photos.length}`,
    `PDF report attached: ${ref}-job-allocation.pdf`,
    '',
    `Track: ${track}`,
    `Staff portal: ${admin}`,
    '',
    'Please action this job within 7 days.',
    'CC: helpdesk@requirebuilding.com.au'
  ].join('\n');

  const photoHtml =
    photos.length > 0
      ? `<p style="margin:16px 0 8px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Photos (${photos.length}) — also attached</p>
         <div style="display:flex;flex-wrap:wrap;gap:8px;">
           ${photos
             .map(
               (p, i) =>
                 `<img src="${p.data_url}" alt="Photo ${i + 1}" width="120" height="120" style="object-fit:cover;border-radius:8px;border:1px solid #eee;width:120px;height:120px;" />`
             )
             .join('')}
         </div>`
      : `<p style="margin:16px 0;font-size:13px;color:#888;">No photos attached to this job.</p>`;

  const html = emailShell(`
    <h1 style="margin:8px 0 8px;font-size:22px;font-weight:600;">Job allocated to you</h1>
    <p style="margin:0 0 12px;padding:10px 12px;background:#FEF3C7;border-radius:8px;font-size:14px;color:#92400E;">
      <strong>Action required within 7 days</strong> — please complete or update by <strong>${escapeHtml(actionBy)}</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:15px;">Reference <strong style="font-family:monospace;">${escapeHtml(ref)}</strong> has been assigned to <strong>${escapeHtml(assigneeName)}</strong>.</p>
    <p style="margin:0 0 20px;">${buttonHtml(track, 'Open this job')}</p>
    <table style="width:100%;font-size:14px;line-height:1.6;border-collapse:collapse;">
      <tr><td style="padding:4px 0;color:#888;width:120px;">Property</td><td style="padding:4px 0;">${escapeHtml(incident.development_name || '—')}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Status</td><td style="padding:4px 0;">${escapeHtml(incident.status || 'assigned')}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Logged</td><td style="padding:4px 0;">${escapeHtml(loggedAt)}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Assigned</td><td style="padding:4px 0;">${escapeHtml(assignedAtFmt)}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Action by</td><td style="padding:4px 0;"><strong>${escapeHtml(actionBy)}</strong></td></tr>
      <tr><td style="padding:4px 0;color:#888;">Reporter</td><td style="padding:4px 0;">${escapeHtml(incident.reporter_name || '—')}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Contact</td><td style="padding:4px 0;">${escapeHtml(incident.reporter_contact || '—')}</td></tr>
    </table>
    <p style="margin:16px 0 4px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Description</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(incident.description || '')}</p>
    ${photoHtml}
    <p style="margin:20px 0 0;font-size:13px;color:#555;">A PDF job allocation report is attached (${escapeHtml(ref)}-job-allocation.pdf).</p>
  `);

  const results = {};

  if (assigneeEmail) {
    results.assignee = await sendEmail(env, {
      to: assigneeEmail,
      cc: staffInbox,
      subject: `You have been assigned job ${ref} — action by ${actionBy}`,
      text,
      html,
      attachments
    });
  } else {
    results.admin_only = await sendEmail(env, {
      to: staffInbox,
      subject,
      text: text + '\n\n[Note: no email on file for assignee — add email on staff/contractor profile]',
      html,
      attachments
    });
  }

  if (assigneeEmail) {
    results.admin = await sendEmail(env, {
      to: staffInbox,
      subject,
      text,
      html,
      attachments
    });
  }

  return results;
}
