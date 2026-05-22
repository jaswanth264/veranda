# Veranda — Vendor & Listings HLD

## Overview
This covers Steps 9–11: Vendor profile creation, listing management, and the public browse/home page.

---

## System Flow

```
[User registers as vendor]
         │
         ▼
[Complete vendor profile]  ←── Step 9
  business_name, category,
  description, address, lat/lng
         │
         ▼
[Create listings]          ←── Step 10
  title, price, images,
  category, description
         │
         ▼
[Go live — visible to customers]  ←── Step 11
  customers browse by category
  + location on home page
```

---

## Step 9 — Vendor Profile API + UI

### API Endpoints

| Method | Route                      | Auth     | Description                        |
|--------|---------------------------|----------|------------------------------------|
| POST   | `/api/vendor/profile`      | Required | Create vendor profile              |
| GET    | `/api/vendor/profile/me`   | Required | Get own vendor profile             |
| PUT    | `/api/vendor/profile`      | Required | Update vendor profile              |
| GET    | `/api/vendor/:id`          | Public   | Get any vendor's public profile    |

### POST `/api/vendor/profile` — Request Body
```json
{
  "business_name": "Lakshmi Tiffins",
  "description": "Fresh home-cooked South Indian meals daily",
  "category": "tiffin",
  "address": "Vijayawada, Andhra Pradesh",
  "lat": 16.5062,
  "lng": 80.6480
}
```

### Flow Diagram
```
Customer (role=vendor)       Server                    DB
        │                       │                       │
        │── POST /vendor/profile ──▶│                   │
        │                       │── check role=vendor   │
        │                       │── INSERT vendor_profiles
        │                       │── audit_log: vendor_profile_created
        │◀── 201 { vendor_profile } ─│                  │
```

---

## Step 10 — Listings API + UI

### API Endpoints

| Method | Route                        | Auth     | Description                     |
|--------|------------------------------|----------|---------------------------------|
| POST   | `/api/listings`               | Required | Create a listing                |
| GET    | `/api/listings/mine`          | Required | Vendor's own listings           |
| PUT    | `/api/listings/:id`           | Required | Update listing                  |
| DELETE | `/api/listings/:id`           | Required | Deactivate listing              |
| GET    | `/api/listings`               | Public   | Browse all active listings      |
| GET    | `/api/listings/:id`           | Public   | Single listing detail           |
| GET    | `/api/listings/category/:type`| Public   | Filter by services or tiffin    |

### POST `/api/listings` — Request Body
```json
{
  "title": "Veg Tiffin - Lunch",
  "description": "Rice, 2 curries, dal, pickle. Fresh daily.",
  "category_id": 1,
  "price": 80,
  "unit": "per meal",
  "images": []
}
```

---

## Step 11 — Home / Browse Page

### What the customer sees:
```
┌─────────────────────────────────────────┐
│  🏠 Veranda          [Search...]  [👤]  │
├─────────────────────────────────────────┤
│  Categories:                            │
│  [🍱 Tiffin] [🔧 Plumber] [⚡ Elec..]  │
├─────────────────────────────────────────┤
│  Near you in Vijayawada                 │
│  ┌──────────┐  ┌──────────┐            │
│  │ Lakshmi  │  │  Ravi AC │            │
│  │ Tiffins  │  │  Repair  │            │
│  │ ⭐4.8    │  │  ⭐4.5   │            │
│  │ ₹80/meal │  │ ₹350/hr  │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

### Browse API
`GET /api/listings?category=tiffin&city=Vijayawada&page=1&limit=10`

---

## Frontend Pages (Web)

| Page                    | Route                   | Who sees it        |
|------------------------|-------------------------|--------------------|
| Home / Browse           | `/`                     | Everyone           |
| Vendor Setup            | `/vendor/setup`         | Vendors only       |
| Vendor Dashboard        | `/vendor/dashboard`     | Vendors only       |
| Create Listing          | `/vendor/listings/new`  | Vendors only       |
| Listing Detail          | `/listings/:id`         | Everyone           |
| Customer Dashboard      | `/dashboard`            | Customers only     |

---

## Folder Structure (Server)

```
server/src/
├── routes/
│   ├── auth.js        ✅ done
│   ├── vendor.js      ← Step 9
│   └── listings.js    ← Step 10
├── controllers/
│   ├── vendor.js      ← business logic
│   └── listings.js
├── middleware/
│   └── auth.js        ✅ done
└── supabase.js        ✅ done
```

---

## Folder Structure (Web)

```
apps/web/src/
├── pages/
│   ├── LoginPage.jsx       ✅ done
│   ├── RegisterPage.jsx    ✅ done
│   ├── DashboardPage.jsx   ✅ done
│   ├── HomePage.jsx        ← Step 11
│   ├── VendorSetupPage.jsx ← Step 9
│   ├── VendorDashboard.jsx ← Step 9
│   ├── CreateListingPage.jsx ← Step 10
│   └── ListingDetailPage.jsx ← Step 10
├── api/
│   ├── client.js     ✅ done
│   ├── auth.js       ✅ done
│   ├── vendor.js     ← Step 9
│   └── listings.js   ← Step 10
└── context/
    └── AuthContext.jsx ✅ done
```

---

## Mobile App Strategy

### When to build mobile
Build mobile **in parallel** starting from Step 9. The backend API is the same — mobile just has a different frontend.

### Key difference: Auth on Mobile
| Platform | Token Storage         | Why                                |
|----------|-----------------------|------------------------------------|
| Web      | httpOnly Cookie       | JS can't access — XSS proof        |
| Mobile   | `expo-secure-store`   | Encrypted on device, OS-protected  |

On mobile, `httpOnly` cookies don't work the same way. We use `expo-secure-store` (hardware-encrypted storage on Android/iOS) — equivalent security level.

### Mobile Flow (login):
```
Mobile App              Server               Supabase
    │                      │                     │
    │── POST /auth/login ──▶│                    │
    │   (JSON body)         │── signIn ──────────▶│
    │                       │◀─ session ──────────│
    │◀── 200 { access_token, user } ─│           │
    │                                             │
    [Store in expo-secure-store]
    [Send as Authorization: Bearer on next requests]
```

### Mobile Tech Stack
| What              | Package                      |
|------------------|------------------------------|
| Framework         | React Native (Expo SDK 52)   |
| Navigation        | `@react-navigation/native`   |
| Auth storage      | `expo-secure-store`          |
| HTTP client       | `axios`                      |
| UI components     | `react-native-paper` or NativeWind (Tailwind for RN) |
| Location          | `expo-location`              |
| Image picker      | `expo-image-picker`          |
| Notifications     | `expo-notifications`         |

### Mobile Screens (Phase 1)
```
Screens to build alongside web:
├── Auth
│   ├── LoginScreen
│   └── RegisterScreen
├── Customer
│   ├── HomeScreen (browse by category)
│   ├── ListingDetailScreen
│   └── BookingScreen
└── Vendor
    ├── VendorSetupScreen
    ├── VendorDashboardScreen
    └── CreateListingScreen
```

### Note: Server changes needed for mobile auth
The login/register routes need to return the token in the JSON body (not just cookies) so the mobile app can store it. We'll add this in Step 9 when we start mobile.

---

## Summary

```
Step 9  → Vendor profile API + web UI + mobile auth setup
Step 10 → Listings CRUD API + web UI + mobile screens
Step 11 → Home/browse page (web + mobile)
Step 12 → Booking flow
```

Start with Step 9?
