const { supabaseAdmin } = require('../supabase');

// Reads JWT from httpOnly cookie, verifies with Supabase, attaches user to req
const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = user;
    req.accessToken = token;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Auth check failed' });
  }
};

module.exports = { requireAuth };
