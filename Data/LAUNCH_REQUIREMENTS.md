# Veranda — Launch Requirements & Local Dev Guide

---

## PART 1 — LOCAL DEVELOPMENT (Zero Cost)

Everything below runs 100% free on your machine before going live.

### 1.1 Tools to Install (All Free)
| Tool              | Purpose                        | Download |
|------------------|-------------------------------|----------|
| Node.js (v20+)    | Backend + build tooling        | nodejs.org |
| Git               | Version control                | git-scm.com |
| VS Code           | Editor (already have)          | — |
| Supabase CLI      | Local Postgres + Auth + Storage| `npm i -g supabase` |
| Expo Go (phone)   | Test React Native on your phone| Play Store |
| Postman           | Test API endpoints             | postman.com (free) |
| TablePlus / DBeaver | View local DB (optional)    | tableplus.com (free tier) |

---

### 1.2 Local Setup — Step by Step

#### Step 1: Supabase Local (replaces cloud DB for dev)
```bash
# Install Supabase CLI
npm install -g supabase

# Inside your project root
supabase init
supabase start   # starts local Postgres + Auth + Storage + Studio UI

# Access local Supabase Studio at:
# http://localhost:54323
```
> This gives you a full Supabase stack locally — no account, no cost, no internet needed.

#### Step 2: Backend (Node + Express)
```bash
cd server
npm install
cp .env.example .env   # fill with local Supabase URLs (printed by `supabase start`)
npm run dev            # runs on http://localhost:5000
```

#### Step 3: Web Frontend (React + Vite)
```bash
cd apps/web
npm install
cp .env.example .env   # fill with local Supabase anon key
npm run dev            # runs on http://localhost:5173
```

#### Step 4: Mobile App (Expo)
```bash
cd apps/mobile
npm install
npx expo start         # shows QR code
# Scan QR with Expo Go app on your phone (same Wi-Fi network)
```

#### Step 5: Payments (Razorpay Test Mode)
- Sign up free at razorpay.com
- Use **Test Mode** keys — no real money moves
- Test card: `4111 1111 1111 1111`, any future date, any CVV
- All payment testing is free in test mode

---

### 1.3 Free Local Services Summary
| Service         | Local Tool              | Cost |
|----------------|------------------------|------|
| Database        | Supabase CLI (local)    | Free |
| Auth            | Supabase CLI (local)    | Free |
| File Storage    | Supabase CLI (local)    | Free |
| Backend API     | Node.js localhost       | Free |
| Web frontend    | Vite dev server         | Free |
| Mobile testing  | Expo Go (phone app)     | Free |
| Payments        | Razorpay Test Mode      | Free |
| Email (optional)| Mailpit (local SMTP)    | Free |

---

## PART 2 — PRE-LAUNCH REQUIREMENTS (India)

### 2.1 Business / Legal (India — Andhra Pradesh)

#### A. Business Registration (Pick One)
| Type                     | Cost      | When Needed |
|--------------------------|-----------|-------------|
| Sole Proprietorship       | ~₹0–500  | Simplest; use your own PAN |
| LLP (Limited Liability)   | ~₹5,000  | If you add co-founders later |
| Private Limited Company   | ~₹7,000+ | For investor funding |

> **Recommendation for solo dev:** Start as **Sole Proprietorship** — just use your PAN. No formal registration needed until income crosses ₹20L/year.

---

#### B. GST Registration
- **Required when** annual revenue crosses **₹20 Lakhs** (₹10L for some states)
- **Free** to register at gstin.gov.in
- Needed to collect GST on service fees / commissions
- Get a **GSTIN number** before invoicing vendors

---

#### C. FSSAI License (Mandatory for Tiffin/Food Side)
| License Type       | Applicable When             | Cost      |
|-------------------|----------------------------|-----------|
| FSSAI Basic        | Turnover < ₹12L/year       | ₹100/year |
| FSSAI State        | Turnover ₹12L – ₹20Cr     | ₹2,000–5,000/year |

- **Every home cook listing food MUST have FSSAI registration**
- As a platform, you need to **verify and display** their FSSAI number
- Apply at: **foscos.fssai.gov.in**

---

#### D. Shop & Establishment Act Registration
- Register your business with **local municipal authority (Vijayawada / Gudivada)**
- Required to open a bank account in business name
- Cost: ~₹500–2,000 depending on employee count
- Apply at AP Government portal or local municipal office

---

#### E. Payment Gateway (Razorpay) — KYC
To go live (not test mode), Razorpay requires:
- [ ] PAN card
- [ ] Bank account (current or savings)
- [ ] Business proof (GST / registration certificate / cancelled cheque)
- [ ] Website with Privacy Policy, Refund Policy, Terms of Service pages
- [ ] Approval takes 2–5 business days — **100% free to activate**

---

### 2.2 App Store Requirements

#### Google Play Store
| Requirement       | Details                          |
|------------------|----------------------------------|
| Developer Account | One-time fee: **$25 (~₹2,100)** |
| App Signing       | Handled by Expo EAS              |
| Privacy Policy    | Must be publicly accessible URL  |
| Age Rating        | Fill out content rating form     |
| Target API Level  | Must target Android 14 (API 34+) |

#### Apple App Store
| Requirement       | Details                          |
|------------------|----------------------------------|
| Developer Account | Annual fee: **$99/year (~₹8,200)**|
| Privacy Policy    | Mandatory URL                    |
| App Review        | 1–3 days review time             |

> **For launch, start with Play Store only** (Android dominant in India, cheaper).

---

### 2.3 Legal Pages Required on Website
These are mandatory for payment gateway + app stores:

| Page             | Content Needed                          |
|-----------------|----------------------------------------|
| Privacy Policy   | What data you collect, how it's used   |
| Terms of Service | Rules for vendors and customers        |
| Refund Policy    | Cancellation & refund rules            |
| Contact Us       | Valid email + phone                    |

> Free tool to generate drafts: **termly.io** or **privacypolicygenerator.info**

---

### 2.4 Domain & Hosting (Free Tier)
| Service     | Free Plan Limits                        |
|------------|----------------------------------------|
| Vercel      | Unlimited deployments, 100GB bandwidth/month |
| Render      | 750 hrs/month (backend — sleeps after 15 min idle) |
| Supabase    | 500MB DB, 1GB storage, 50K auth users  |
| Expo EAS    | 30 builds/month free                   |

> **Domain**: Buy from Namecheap (~₹700/year for `.in`) or GoDaddy. Free `.vercel.app` subdomain works for testing.

---

## PART 3 — LAUNCH CHECKLIST

### Before Going Live
- [ ] Supabase cloud project created & migrations applied
- [ ] Backend deployed on Render
- [ ] Web app deployed on Vercel
- [ ] Razorpay KYC done & live keys added
- [ ] Privacy Policy, ToS, Refund Policy pages live on website
- [ ] FSSAI verification flow for home cooks added
- [ ] Custom domain connected (optional but professional)
- [ ] Error monitoring added (free: Sentry free tier)
- [ ] At least 5 test vendors onboarded manually
- [ ] End-to-end booking + payment tested with real cards

### Before Play Store Submission
- [ ] Expo EAS build (APK/AAB) generated
- [ ] App screenshots (min 2) taken
- [ ] Google Play Developer account created ($25)
- [ ] Privacy Policy URL live
- [ ] Content rating form filled
- [ ] App tested on real Android device

---

## PART 4 — TOTAL COST ESTIMATE TO LAUNCH

| Item                          | Cost          |
|------------------------------|--------------|
| Development (local)           | ₹0           |
| Supabase / Vercel / Render    | ₹0 (free tier)|
| FSSAI Basic License           | ₹100/year     |
| GST Registration              | ₹0           |
| Razorpay Activation           | ₹0 (2% per transaction) |
| Google Play Store account     | ₹2,100 (one-time) |
| Domain (.in)                  | ₹700/year     |
| **Total to launch (Android)** | **~₹2,900**  |
| Apple App Store (optional)    | +₹8,200/year  |

---

## PART 5 — USEFUL LINKS

| Resource                   | URL                              |
|---------------------------|----------------------------------|
| Supabase CLI docs          | supabase.com/docs/guides/cli     |
| Expo EAS Build             | docs.expo.dev/build/introduction |
| Razorpay Test Mode         | razorpay.com/docs/payments/dashboard/test-mode |
| FSSAI Registration         | foscos.fssai.gov.in              |
| GST Registration           | gstin.gov.in                     |
| Play Console               | play.google.com/console          |
| Privacy Policy Generator   | privacypolicygenerator.info      |
