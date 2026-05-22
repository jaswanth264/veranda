# Veranda — Authentication Reference

## Strategy: httpOnly Cookie-Based Auth

We use **Supabase Auth** for identity management + **httpOnly cookies** to store session tokens on the server side.

---

## Why httpOnly Cookies (not localStorage)?

| Storage         | XSS Attack Risk | CSRF Risk | Recommendation |
|----------------|----------------|-----------|---------------|
| `localStorage`  | ❌ HIGH — JS can read it | ✅ Safe | Never for tokens |
| `sessionStorage`| ❌ HIGH — JS can read it | ✅ Safe | Never for tokens |
| httpOnly Cookie | ✅ Safe — JS cannot read | ⚠️ Needs SameSite | ✅ **Best practice** |

**XSS (Cross-Site Scripting):** If an attacker injects JS into your page, they can steal `localStorage` tokens. httpOnly cookies are completely invisible to JS — even malicious scripts can't read them.

**CSRF (Cross-Site Request Forgery):** We mitigate this with `SameSite: lax` on the cookie.

---

## Cookie Configuration

```js
{
  httpOnly: true,       // JS cannot access — XSS protection
  secure: true,         // HTTPS only (set in production)
  sameSite: 'lax',      // Sent on same-site requests + top-level navigations
  maxAge: 7 days,       // access_token expiry
  path: '/',
}
```

**Two cookies are set:**
- `access_token` — expires in 7 days — used for API calls
- `refresh_token` — expires in 30 days — used to get a new access_token

---

## Auth Flow Diagrams

### Register
```
Client                    Server                   Supabase
  │                          │                         │
  │── POST /api/auth/register ──▶│                      │
  │   { name, email, pwd, role } │                      │
  │                          │── createUser() ─────────▶│
  │                          │◀─ user created ──────────│
  │                          │── signInWithPassword() ──▶│
  │                          │◀─ session tokens ─────────│
  │                          │── UPDATE profiles.role    │
  │◀── 201 + Set-Cookie ─────│                          │
  │   (access_token httpOnly) │                         │
```

### Login
```
Client                    Server                   Supabase
  │                          │                         │
  │── POST /api/auth/login ──▶│                        │
  │   { email, password }     │                        │
  │                          │── signInWithPassword() ──▶│
  │                          │◀─ session tokens ─────────│
  │◀── 200 + Set-Cookie ─────│                          │
  │   (access_token httpOnly) │                         │
```

### Authenticated Request (e.g. GET /api/auth/me)
```
Client                    Server                   Supabase
  │                          │                         │
  │── GET /api/auth/me ──────▶│                        │
  │   (cookie sent auto)      │                        │
  │                     [requireAuth middleware]        │
  │                          │── getUser(token) ───────▶│
  │                          │◀─ user verified ──────────│
  │◀── 200 + profile data ───│                          │
```

### Logout
```
Client                    Server                   Supabase
  │                          │                         │
  │── POST /api/auth/logout ─▶│                        │
  │   (cookie sent auto)      │                        │
  │                          │── signOut(token) ───────▶│
  │                          │── clearCookie()          │
  │◀── 200 { message } ──────│                          │
```

---

## API Reference

### `POST /api/auth/register`
**Body:**
```json
{
  "full_name": "Ravi Kumar",
  "email": "ravi@example.com",
  "password": "securePassword123",
  "phone": "9876543210",
  "role": "customer"
}
```
**role** can be `customer` or `vendor`

**Response (201):**
```json
{
  "message": "Registered successfully",
  "user": { "id": "uuid", "email": "...", "full_name": "...", "role": "customer" }
}
```
**Sets cookies:** `access_token` (7d), `refresh_token` (30d)

---

### `POST /api/auth/login`
**Body:**
```json
{ "email": "ravi@example.com", "password": "securePassword123" }
```
**Response (200):**
```json
{
  "message": "Logged in successfully",
  "user": { "id": "...", "email": "...", "full_name": "...", "role": "customer", "city": "..." }
}
```
**Sets cookies:** `access_token` (7d), `refresh_token` (30d)

---

### `POST /api/auth/logout`
**Requires:** auth cookie

**Response (200):**
```json
{ "message": "Logged out successfully" }
```
**Clears cookies:** `access_token`, `refresh_token`

---

### `GET /api/auth/me`
**Requires:** auth cookie

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "full_name": "Ravi Kumar",
    "role": "vendor",
    "city": "Vijayawada",
    "vendor_profiles": { ... }
  }
}
```

---

## Protecting Routes (Usage)

```js
const { requireAuth } = require('../middleware/auth');

// Any route that needs login:
router.get('/dashboard', requireAuth, (req, res) => {
  // req.user is available here (Supabase user object)
  // req.accessToken is the raw JWT
  res.json({ userId: req.user.id });
});
```

---

## User Activity Tracking

Every login writes to two tables automatically:

### What gets tracked on login:
| Field             | Table           | Value                          |
|------------------|----------------|-------------------------------|
| `last_logged_in`  | `profiles`      | Current timestamp              |
| `login_count`     | `profiles`      | Incremented by 1               |
| `ip_address`      | `user_sessions` | Client IP (`x-forwarded-for`)  |
| `user_agent`      | `user_sessions` | Browser / device string        |
| `expires_at`      | `user_sessions` | Token expiry from Supabase     |
| `event: 'login'`  | `audit_logs`    | With email + IP in metadata    |

### Account deactivation:
- Admin sets `profiles.is_active = false`
- Next login attempt returns `403 Account is deactivated`
- Existing tokens still valid until expiry — force-logout via Supabase admin if needed

### Events logged in `audit_logs`:
| Event              | When                       |
|-------------------|---------------------------|
| `register`         | New user signs up          |
| `login`            | Successful login           |
| `booking_created`  | New booking placed (soon)  |
| `booking_cancelled`| Booking cancelled (soon)   |

---

## Security Checklist

- [x] Tokens stored in httpOnly cookies (not localStorage)
- [x] `secure: true` in production (HTTPS only)
- [x] `sameSite: lax` (CSRF protection)
- [x] CORS restricted to known frontend URL
- [x] `credentials: true` on CORS (required for cookies)
- [x] Service key only used server-side (never sent to frontend)
- [x] Passwords handled entirely by Supabase (bcrypt internally)
- [x] Input validation on all auth endpoints
- [x] Deactivated accounts blocked at login
- [x] Login events logged with IP + user-agent
- [x] Audit trail for all major events
- [ ] Rate limiting on login endpoint (add before production)
- [ ] Refresh token rotation (Supabase handles automatically)
