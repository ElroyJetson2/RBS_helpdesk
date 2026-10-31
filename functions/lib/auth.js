/** Shared admin auth helpers */

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/** Decode Bearer token → { username, password } or null */
export function decodeToken(request) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const raw = atob(header.slice(7));
    const idx = raw.indexOf(':');
    if (idx < 0) return null;
    return { username: raw.slice(0, idx), password: raw.slice(idx + 1) };
  } catch {
    return null;
  }
}

/** Load staff row from token. Returns null if invalid. */
export async function getStaffFromRequest(env, request) {
  const creds = decodeToken(request);
  if (!creds) return null;
  const staff = await env.DB.prepare(
    'SELECT id, username, display_name, password_hash, role, email FROM staff WHERE username = ?'
  ).bind(creds.username).first();
  if (!staff || staff.password_hash !== creds.password) return null;
  return {
    id: staff.id,
    username: staff.username,
    display_name: staff.display_name || staff.username,
    role: staff.role || 'admin',
    email: staff.email || null
  };
}

export const VALID_STATUSES = ['open', 'assigned', 'in_progress', 'customer_sign_off', 'closed'];

export function statusLabel(s) {
  const map = {
    open: 'Open',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    customer_sign_off: 'Customer Sign Off',
    closed: 'Closed'
  };
  return map[s] || s;
}
