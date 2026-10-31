/**
 * POST /api/admin/login
 * Returns token + role + display_name
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ error: 'Username and password required' }, 400);
    }

    const staff = await env.DB.prepare(
      'SELECT id, username, display_name, password_hash, role, email FROM staff WHERE username = ?'
    ).bind(username.trim()).first();

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
