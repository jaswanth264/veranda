const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Admin client — uses service key, bypasses RLS
// Use ONLY for DB read/write operations, never for auth sign-in
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false, // never store a user session on this client
    },
  }
);

// Auth client — uses anon key, used ONLY for signInWithPassword / signUp
// Kept separate so it never pollutes the admin client's auth state
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// User client factory — uses user's JWT, respects RLS
const supabaseUser = (accessToken) =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

module.exports = { supabaseAdmin, supabaseAuth, supabaseUser };
