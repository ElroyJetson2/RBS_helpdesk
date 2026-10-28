/**
 * Send email via Resend API (set RESEND_API_KEY in Pages env vars).
 * Staff inbox: STAFF_EMAIL or default eliteresortcare@gmail.com
 */
const STAFF_EMAIL = 'eliteresortcare@gmail.com';
const SITE = 'https://gc-jobs.pages.dev';

export function staffEmail(env) {
  return (env.STAFF_EMAIL || STAFF_EMAIL).trim().toLowerCase();
}

export function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export async function sendEmail(env, { to, subject, text, html }) {
  const key = env.RESEND_API_KEY;
  if (!key) {
    console.log('[email skipped – no RESEND_API_KEY]', { to, subject });
    return { ok: false, skipped: true, reason: 'RESEND_API_KEY not set' };
  }
  const from = env.EMAIL_FROM || 'Elite Resort Care <onboarding@resend.dev>';
  const recipients = (Array.isArray(to) ? to : [to]).map((a) => String(a).trim().toLowerCase());
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        text,
        html: html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`
      })
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
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
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
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#C9A962;">Elite Resort Care</p>
    ${inner}
  </div>
  <p style="text-align:center;font-size:11px;color:#888;margin:16px;">Gold Coast property maintenance</p>
</body></html>`;
}

export async function notifyNewJob(env, incident) {
  const staff = staffEmail(env);
  const ref = incident.reference;
  const track = jobUrl(ref);
  const admin = `${SITE}/admin.html`;
  const subject = `[New job] ${ref} – ${incident.development_name || 'Property'}`;

  const text = [
    'A new incident has been logged.',
    '',
    `Reference: ${ref}`,
    `Property: ${incident.development_name || '—'}`,
    `Unit: ${incident.unit || '—'}`,
    `Reporter: ${incident.reporter_name}`,
    `Contact: ${incident.reporter_contact}`,
    '',
    'Description:',
    incident.description,
    '',
    `Open this job: ${track}`,
    `Staff portal: ${admin}`
  ].join('\n');

  const html = emailShell(`
    <h1 style="margin:8px 0 16px;font-size:22px;font-weight:600;">New incident logged</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">A customer has submitted a maintenance request. Click below to open the job.</p>
    <p style="margin:0 0 20px;">${buttonHtml(track, 'Open this job')}</p>
    <table style="width:100%;font-size:14px;line-height:1.6;border-collapse:collapse;">
      <tr><td style="padding:4px 0;color:#888;width:110px;">Reference</td><td style="padding:4px 0;font-weight:600;font-family:monospace;">${escapeHtml(ref)}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Property</td><td style="padding:4px 0;">${escapeHtml(incident.development_name || '—')}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Unit</td><td style="padding:4px 0;">${escapeHtml(incident.unit || '—')}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Reporter</td><td style="padding:4px 0;">${escapeHtml(incident.reporter_name)}</td></tr>
      <tr><td style="padding:4px 0;color:#888;">Contact</td><td style="padding:4px 0;">${escapeHtml(incident.reporter_contact)}</td></tr>
    </table>
    <p style="margin:16px 0 4px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Description</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(incident.description || '')}</p>
    <p style="margin:0;font-size:13px;">
      <a href="${track}" style="color:#C9A962;">${escapeHtml(track)}</a><br/>
      <a href="${admin}" style="color:#C9A962;">Staff portal</a>
    </p>
  `);

  return sendEmail(env, { to: staff, subject, text, html });
}

export async function notifyStatusChange(env, incident, note) {
  const staff = staffEmail(env);
  const ref = incident.reference;
  const track = jobUrl(ref);
  const subject = `[${incident.status === 'closed' ? 'Closed' : 'Update'}] ${ref}`;

  const text = [
    `Job ${ref} is now: ${incident.status.toUpperCase()}`,
    '',
    `Property: ${incident.development_name || '—'}`,
    `Unit: ${incident.unit || '—'}`,
    note ? `Note: ${note}` : '',
    '',
    `Open this job: ${track}`
  ].filter(Boolean).join('\n');

  const html = emailShell(`
    <h1 style="margin:8px 0 16px;font-size:22px;font-weight:600;">Job ${escapeHtml(incident.status)}</h1>
    <p style="margin:0 0 16px;font-size:15px;">Reference <strong style="font-family:monospace;">${escapeHtml(ref)}</strong> is now <strong>${escapeHtml(incident.status.toUpperCase())}</strong>.</p>
    <p style="margin:0 0 20px;">${buttonHtml(track, 'Open this job')}</p>
    ${note ? `<p style="margin:0 0 16px;font-size:14px;"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ''}
    <p style="margin:0;font-size:13px;"><a href="${track}" style="color:#C9A962;">${escapeHtml(track)}</a></p>
  `);

  const staffResult = await sendEmail(env, { to: staff, subject, text, html });

  let customerResult = null;
  if (isEmail(incident.reporter_contact)) {
    const custText = [
      `Hello ${incident.reporter_name},`,
      '',
      `Your maintenance request ${ref} is now marked: ${incident.status.toUpperCase()}.`,
      note ? `\nUpdate from staff: ${note}` : '',
      '',
      'Track progress anytime:',
      track,
      '',
      '— Elite Resort Care'
    ].join('\n');
    const custHtml = emailShell(`
      <h1 style="margin:8px 0 16px;font-size:22px;font-weight:600;">Update on your request</h1>
      <p style="margin:0 0 12px;font-size:15px;">Hello ${escapeHtml(incident.reporter_name)},</p>
      <p style="margin:0 0 16px;font-size:15px;">Your request <strong style="font-family:monospace;">${escapeHtml(ref)}</strong> is now <strong>${escapeHtml(incident.status.toUpperCase())}</strong>.</p>
      ${note ? `<p style="margin:0 0 16px;font-size:14px;">${escapeHtml(note)}</p>` : ''}
      <p style="margin:0 0 20px;">${buttonHtml(track, 'Track this job')}</p>
      <p style="margin:0;font-size:13px;"><a href="${track}" style="color:#C9A962;">${escapeHtml(track)}</a></p>
    `);
    customerResult = await sendEmail(env, {
      to: incident.reporter_contact.trim(),
      subject: `Your job ${ref} is ${incident.status}`,
      text: custText,
      html: custHtml
    });
  }
  return { staff: staffResult, customer: customerResult };
}

export async function notifyReminder(env, incident) {
  const staff = staffEmail(env);
  const ref = incident.reference;
  const track = jobUrl(ref);
  const days = Math.floor(
    (Date.now() - new Date(incident.created_at.includes('T') ? incident.created_at : incident.created_at + 'Z').getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const subject = `[Reminder] Open job ${ref} (${days}+ days)`;
  const text = [
    `This job is still OPEN after ${days} days.`,
    '',
    `Reference: ${ref}`,
    `Property: ${incident.development_name || '—'}`,
    `Unit: ${incident.unit || '—'}`,
    `Reporter: ${incident.reporter_name} · ${incident.reporter_contact}`,
    '',
    `Open this job: ${track}`,
    `Staff portal: ${SITE}/admin.html`
  ].join('\n');

  const html = emailShell(`
    <h1 style="margin:8px 0 16px;font-size:22px;font-weight:600;">Open job reminder</h1>
    <p style="margin:0 0 16px;font-size:15px;">Job <strong style="font-family:monospace;">${escapeHtml(ref)}</strong> is still open after <strong>${days}+ days</strong>.</p>
    <p style="margin:0 0 20px;">${buttonHtml(track, 'Open this job')}</p>
    <p style="margin:0;font-size:13px;"><a href="${track}" style="color:#C9A962;">${escapeHtml(track)}</a></p>
  `);

  return sendEmail(env, { to: staff, subject, text, html });
}
