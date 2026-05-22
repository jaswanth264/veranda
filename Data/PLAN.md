# Veranda — Hyperlocal Services + Tiffin/Home Cook Marketplace

## Overview
A combined platform where users can:
- Book **hyperlocal services** (plumbers, electricians, cleaners, etc.)
- Order **home-cooked tiffin meals** from local home cooks
- Vendors/cooks can **list their services** and get bookings

## Revenue Model
- **5–10% commission** per confirmed booking
- **Featured listings** (paid promotion for vendors/cooks)

---

## Tech Stack

| Layer        | Technology               | Hosting (Free)    |
|-------------|--------------------------|-------------------|
| Frontend Web | React + Vite + Tailwind  | Vercel            |
| Mobile App   | React Native (Expo)      | Expo EAS Free     |
| Backend API  | Node.js + Express        | Render            |
| Database     | PostgreSQL (Supabase)    | Supabase Free     |
| Auth         | Supabase Auth            | Supabase Free     |
| File Storage | Supabase Storage         | Supabase Free     |
| Payments     | Razorpay (India)         | Free to integrate |

---

## User Roles
1. **Customer** — searches, books, pays
2. **Vendor/Cook** — lists service/tiffin, manages orders
3. **Admin** — manages platform, resolves disputes

---

## Core Features

### Phase 1 — MVP (Weeks 1–4)
- [ ] Auth (sign up / login / OTP via Supabase)
- [ ] Customer: Browse services & tiffin listings by location
- [ ] Vendor: Register, create profile, list service/menu
- [ ] Booking flow (request → confirm → complete)
- [ ] Basic order management dashboard (vendor side)
- [ ] Basic booking history (customer side)

### Phase 2 — Payments & Reviews (Weeks 5–7)
- [ ] Razorpay payment integration
- [ ] Commission deduction logic (backend)
- [ ] Ratings & reviews after booking completion
- [ ] Push notifications (Expo Notifications)

### Phase 3 — Growth Features (Weeks 8–10)
- [ ] Featured listing (paid promotion)
- [ ] Search filters (distance, rating, price, cuisine type)
- [ ] Tiffin subscription (weekly/monthly plans)
- [ ] Admin dashboard (manage users, payouts, disputes)

### Phase 4 — Polish & Launch (Weeks 11–12)
- [ ] SEO for web (React Helmet / meta tags)
- [ ] PWA support
- [ ] Play Store / App Store submission
- [ ] Analytics (free: Plausible / Umami self-hosted)

---

## Database Schema (Supabase/PostgreSQL)

### `users`
| Column       | Type      |
|-------------|-----------|
| id           | uuid (PK) |
| name         | text      |
| phone        | text      |
| email        | text      |
| role         | enum (customer, vendor, admin) |
| city         | text      |
| created_at   | timestamp |

### `vendor_profiles`
| Column         | Type    |
|---------------|---------|
| id             | uuid    |
| user_id        | uuid FK |
| category       | enum (services, tiffin) |
| business_name  | text    |
| description    | text    |
| location       | text    |
| lat / lng      | float   |
| is_featured    | boolean |
| is_verified    | boolean |
| rating         | float   |

### `listings`
| Column       | Type    |
|-------------|---------|
| id           | uuid    |
| vendor_id    | uuid FK |
| title        | text    |
| description  | text    |
| price        | numeric |
| category     | text    |
| images       | text[]  |
| is_active    | boolean |

### `bookings`
| Column       | Type    |
|-------------|---------|
| id           | uuid    |
| customer_id  | uuid FK |
| listing_id   | uuid FK |
| vendor_id    | uuid FK |
| status       | enum (pending, confirmed, completed, cancelled) |
| scheduled_at | timestamp |
| amount       | numeric |
| commission   | numeric |
| payment_id   | text    |
| created_at   | timestamp |

### `reviews`
| Column     | Type    |
|-----------|---------|
| id         | uuid    |
| booking_id | uuid FK |
| rating     | int (1-5) |
| comment    | text    |
| created_at | timestamp |

---

## Folder Structure (Monorepo)

```
veranda/
├── apps/
│   ├── web/          ← React + Vite (Vercel)
│   └── mobile/       ← React Native Expo
├── server/           ← Node.js + Express (Render)
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   └── supabase.js
├── supabase/
│   └── migrations/   ← SQL migration files
└── PLAN.md
```

---

## Environment Variables

```
# server/.env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
PORT=5000

# apps/web/.env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=
```

---

## Milestones

| Milestone         | Target     | Status |
|------------------|------------|--------|
| Repo + DB setup   | Week 1     | ⬜     |
| Auth working      | Week 1     | ⬜     |
| Vendor listings   | Week 2     | ⬜     |
| Booking flow      | Week 3     | ⬜     |
| Payments live     | Week 5     | ⬜     |
| Mobile app ready  | Week 8     | ⬜     |
| Public launch     | Week 12    | ⬜     |

---

## Next Immediate Steps
1. Initialize monorepo structure
2. Create Supabase project + run migrations
3. Set up Express server with Supabase client
4. Build auth screens (web + mobile)
5. Build vendor listing creation flow
