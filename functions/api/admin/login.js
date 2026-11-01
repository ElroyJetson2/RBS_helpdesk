/**
 * POST /api/admin/login
 * Returns token + role + display_name
 * Tolerates DBs that have not yet been migrated (missing role/email columns).
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ error: 'Username and password required' }, 400);
    }

    const user = (username || '').trim();
    let staff = null;

    // Prefer full row (post-migration)
    try {
      staff = await env.DB.prepare(
        'SELECT id, username, display_name, password_hash, role, email FROM staff WHERE username = ?'
      ).bind(user).first();
    } catch (e) {
      staff = null;
    }

    if (!staff) {
      try {
        staff = await env.DB.prepare(
          'SELECT id, username, display_name, password_hash FROM staff WHERE username = ?'
        ).bind(user).first();
        if (staff) {
          staff.role = 'admin';
          staff.email = null;
        }
      } catch (e2) {
        console.error('Login query failed', e2);
        return json({ error: 'Login failed', details: String(e2.message || e2) }, 500);
      }
    }

    if (!staff || staff.password_hash !== password) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    const role = staff.role || 'admin';
    const token = btoa(`${staff.username}:${password}`);

    return json({
      success: true,
      token,
      display_name: staff.display_name || staff.username,
      role,
      username: staff.username,
      email: staff.email || null
    });
  } catch (err) {
    console.error('Login error:', err);
    return json({ error: 'Login failed', details: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
