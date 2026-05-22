-- ============================================================
-- Veranda — Tracking: User Activity + Session Logging
-- ============================================================

-- ─────────────────────────────────────────────
-- Add tracking columns to profiles
-- ─────────────────────────────────────────────
alter table profiles
  add column is_active      boolean      not null default true,
  add column last_logged_in timestamptz,
  add column login_count    int          not null default 0;

-- ─────────────────────────────────────────────
-- USER SESSIONS
-- Logs every login event (device, IP, time)
-- Useful for: "active sessions", security audit, admin view
-- ─────────────────────────────────────────────
create table user_sessions (
  id          uuid         primary key default uuid_generate_v4(),
  profile_id  uuid         not null references profiles(id) on delete cascade,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz  not null default now(),
  expires_at  timestamptz
);

-- ─────────────────────────────────────────────
-- AUDIT LOGS
-- Tracks important platform events for debugging + admin
-- ─────────────────────────────────────────────
create table audit_logs (
  id          uuid         primary key default uuid_generate_v4(),
  profile_id  uuid         references profiles(id) on delete set null,
  event       text         not null,  -- e.g. 'login', 'register', 'booking_created'
  metadata    jsonb,                  -- any extra context
  ip_address  text,
  created_at  timestamptz  not null default now()
);

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table user_sessions enable row level security;
alter table audit_logs     enable row level security;

-- Users can only see their own sessions
create policy "Users can view own sessions"
  on user_sessions for select
  using (profile_id in (select id from profiles where user_id = auth.uid()));

-- Only admins can view audit logs (via service key on backend)
-- No public RLS policy = only accessible via service key
