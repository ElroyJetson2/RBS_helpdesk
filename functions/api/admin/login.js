/**
 * POST /api/admin/login
 * Simple username/password login. Returns a token (base64 of username:password for demo).
 * In production replace with proper JWT or Cloudflare Access.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ error: 'Username and password required' }, 400);
    }

    const staff = await env.DB.prepare(
      'SELECT id, username, display_name, password_hash FROM staff WHERE username = ?'
    ).bind(username.trim()).first();

    if (!staff || staff.password_hash !== password) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    // Simple token for demo (username:password base64). Replace with proper auth later.
    const token = btoa(`${staff.username}:${password}`);

    return json({
      success: true,
      token,
      display_name: staff.display_name || staff.username
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
