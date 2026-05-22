const express = require('express');
const router = express.Router();
const { supabaseAdmin, supabaseAuth } = require('../supabase');
const { requireAuth } = require('../middleware/auth');

// Cookie config — httpOnly prevents JS access (XSS protection)
const COOKIE_OPTIONS = {
  httpOnly: true,              // JS cannot read this cookie
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'lax',             // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/',
};

// ─────────────────────────────────────────
// POST /api/auth/register
// Body: { full_name, email, password, phone, role }
// ─────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password, phone, role = 'customer' } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email and password are required' });
    }

    if (!['customer', 'vendor'].includes(role)) {
      return res.status(400).json({ error: 'role must be customer or vendor' });
    }

    // 1. Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      phone,
      email_confirm: true, // skip email confirmation in dev
      user_metadata: { full_name, phone },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // 2. Update role in profiles (trigger already created the row)
    await supabaseAdmin
      .from('profiles')
      .update({ role, phone })
      .eq('user_id', data.user.id);

    // 3. Log registration in audit (non-blocking)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', data.user.id)
      .single();

    supabaseAdmin.from('audit_logs').insert({
      profile_id: profile?.id,
      event: 'register',
      metadata: { email, role },
      ip_address: ip,
    }).then(({ error }) => {
      if (error) console.error('[track] register audit_log failed:', error.message);
    });

    // 4. Sign in to get session token (use supabaseAuth to not pollute admin client state)
    const { data: session, error: signInError } =
      await supabaseAuth.auth.signInWithPassword({ email, password });

    if (signInError) {
      return res.status(400).json({ error: signInError.message });
    }

    // 4. Set httpOnly cookie
    res.cookie('access_token', session.session.access_token, COOKIE_OPTIONS);
    res.cookie('refresh_token', session.session.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.status(201).json({
      message: 'Registered successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name,
        role,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// ─────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
// ─────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    // Use supabaseAuth (not admin) so the user session doesn't pollute supabaseAdmin
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Fetch profile + vendor_profiles (for frontend redirect logic)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*, vendor_profiles(*)')
      .eq('user_id', data.user.id)
      .single();

    // Block deactivated accounts
    if (profile && profile.is_active === false) {
      return res.status(403).json({ error: 'Account is deactivated. Contact support.' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    // ── Tracking (non-blocking — never fails the login) ──────────────
    const track = async () => {
      try {
        // 1. Update profile tracking fields
        const { error: e1 } = await supabaseAdmin
          .from('profiles')
          .update({
            last_logged_in: new Date().toISOString(),
            login_count: (profile?.login_count || 0) + 1,
          })
          .eq('user_id', data.user.id);
        if (e1) console.error('[track] profiles update failed:', e1.message);

        // 2. Log session
        const { error: e2 } = await supabaseAdmin.from('user_sessions').insert({
          profile_id: profile?.id,
          ip_address: ip,
          user_agent: userAgent,
          expires_at: data.session.expires_at
            ? new Date(data.session.expires_at * 1000).toISOString()
            : null,
        });
        if (e2) console.error('[track] user_sessions insert failed:', e2.message);

        // 3. Audit log
        const { error: e3 } = await supabaseAdmin.from('audit_logs').insert({
          profile_id: profile?.id,
          event: 'login',
          metadata: { email, role: profile?.role },
          ip_address: ip,
        });
        if (e3) console.error('[track] audit_logs insert failed:', e3.message);

      } catch (trackErr) {
        console.error('[track] unexpected error:', trackErr.message);
      }
    };
    track(); // fire-and-forget — does NOT block the login response
    // ─────────────────────────────────────────────────────────────────

    // Set httpOnly cookies
    res.cookie('access_token', data.session.access_token, COOKIE_OPTIONS);
    res.cookie('refresh_token', data.session.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: 'Logged in successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.full_name,
        role: profile?.role,
        city: profile?.city,
        avatar_url: profile?.avatar_url,
        vendor_profiles: profile?.vendor_profiles ?? null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ─────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await supabaseAdmin.auth.admin.signOut(req.accessToken);

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// ─────────────────────────────────────────
// GET /api/auth/me
// Returns current logged-in user's profile
// ─────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*, vendor_profiles(*)')
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.json({ user: profile });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
