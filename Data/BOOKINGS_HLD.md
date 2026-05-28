# Veranda — Bookings High-Level Design (HLD)

---

## 1. Overview

The Booking system is the core revenue engine of Veranda. It handles two distinct service tracks with different workflows:

| Track      | Category Types     | OTP Required | Delivery |
|-----------|-------------------|--------------|---------|
| Services  | plumber, maid, electrician, AC repair, etc. | 2x OTP (arrival + completion) | Vendor goes to customer |
| Tiffin    | tiffin, home cook  | None         | Vendor delivers to customer |

---

## 2. Full Booking State Machine

```mermaid
stateDiagram-v2
    [*] --> pending : Customer creates booking\n(payment_method = online|cod)

    pending --> confirmed : Vendor accepts
    pending --> cancelled : Vendor declines / Customer cancels

    %% Services track
    confirmed --> in_progress : Vendor arrives\nArrival OTP verified by customer
    in_progress --> completed : Service done\nCompletion OTP verified by customer
    in_progress --> cancelled : Vendor/admin cancels

    %% Tiffin track
    confirmed --> out_for_delivery : Vendor dispatches food
    out_for_delivery --> completed : Vendor marks delivered
    out_for_delivery --> cancelled : Vendor/admin cancels

    completed --> [*]
    cancelled --> [*]
```

---

## 3. IO Diagram — Booking API Request/Response

```mermaid
flowchart LR
    subgraph CUSTOMER["👤 Customer"]
        CI["Input:\nlisting_id\nscheduled_at\naddress\nnotes\npayment_method"]
    end

    subgraph SERVER["🖥️ Server — POST /bookings"]
        S1["Validate listing exists\nResolve profileId\nCalculate commission\nSet payment_status"]
        S2{payment_method}
        S3["payment_status = 'pending'\n(online)"]
        S4["payment_status = 'cod_pending'\n(cod)"]
    end

    subgraph OUT["📤 Response"]
        R1["booking_id\nstatus = pending\npayment_status\namount\ncommission"]
    end

    CI --> S1 --> S2
    S2 -->|online| S3 --> R1
    S2 -->|cod| S4 --> R1
```

```mermaid
flowchart LR
    subgraph VENDOR["🔧 Vendor"]
        VI1["I've Arrived click\n→ POST /send-arrival-otp"]
        VI2["Enter arrival OTP\n→ POST /verify-otp"]
        VI3["Mark Done click\n→ POST /send-completion-otp"]
        VI4["Enter completion OTP\n→ POST /verify-otp"]
    end

    subgraph SYS["🖥️ System"]
        SYS1["Generate OTP\nSave to booking\nSend SMS (prod)\nReturn dev_otp"]
        SYS2["Verify OTP\nstatus = in_progress"]
        SYS3["Generate NEW OTP\nSave to booking\nSend SMS (prod)"]
        SYS4["Verify OTP\nstatus = completed\nClear OTP fields"]
    end

    subgraph CUST["👤 Customer"]
        C1["Receives SMS OTP\n(or reads from console)"]
        C2["Reads OTP to vendor"]
        C3["Receives 2nd SMS OTP"]
        C4["Reads OTP to vendor"]
    end

    VI1 --> SYS1 --> C1 --> C2 --> VI2 --> SYS2
    SYS2 --> VI3 --> SYS3 --> C3 --> C4 --> VI4 --> SYS4
```

---

## 4. Services Booking Flow (Dual OTP)

```
CUSTOMER                       SYSTEM                         VENDOR
──────────                     ──────                         ──────
Book listing ──────────────► POST /bookings
                              status = pending
                                                ◄─────────── Accept booking
                              status = confirmed
                                                ◄─────────── Click "I've Arrived"
                              POST /send-arrival-otp
                              Generate 6-digit OTP
                              Save to bookings.completion_otp
SMS: "OTP: 482917" ◄────────  [Production: send SMS]
                              [Dev: return in response]
Read OTP to vendor ──────────────────────────────────────► Enter OTP
                              POST /verify-otp
                              status = in_progress ──────────► See "🔧 In Progress"
                                                               (service being done...)
                                                ◄─────────── Click "Mark Done"
                              POST /send-completion-otp
                              Generate NEW 6-digit OTP
                              Save to bookings.completion_otp
SMS: "OTP: 731042" ◄────────  [Production: send SMS]
                              [Dev: return in response]
Read OTP to vendor ──────────────────────────────────────► Enter OTP
                              POST /verify-otp
                              status = completed ◄──────────► ✅ Booking Complete
```

---

## 4. Services Booking Flow (Dual OTP + COD Payment)

```
CUSTOMER                       SYSTEM                         VENDOR
──────────                     ──────                         ──────
Book listing ──────────────► POST /bookings
Choose pay_method ✓           status = pending
                              [online] payment_status=pending
                              [cod]    payment_status=cod_pending
                                                ◄─────────── Accept booking
                              status = confirmed
                                                ◄─────────── Click "I've Arrived"
                              POST /send-arrival-otp
                              Generate 6-digit OTP
SMS: "OTP: 482917" ◄────────  [Production: send SMS to customer]
                              [Dev: shown in vendor dashboard]
Read OTP to vendor ──────────────────────────────────────► Enter OTP
                              POST /verify-otp (confirmed→in_progress)
                              status = in_progress

── PAYMENT PHASE (COD only) ─────────────────────────────────────────────────
                                                ◄─────────── Click "✅ Mark Done"
                              POST /send-completion-otp
                              Generate NEW 6-digit OTP
                              Saved in bookings.completion_otp
                                                              ⏳ "Ask customer to
                                                              pay → they'll share
                                                              the 6-digit code"
[COD] "Pay ₹XXX to    ◄──── Customer dashboard polls (6s)
 get your code" (CTA)         to detect new completion_otp

Customer pays via ─────────► POST /payments/create-order
Razorpay (UPI/Card)           POST /payments/verify
                              payment_status = paid

"Your code: 731042    ◄──── Booking re-fetched, completion_otp
 — read to vendor"            visible in app only after payment
 (green box)

Read code to vendor ─────────────────────────────────────► Enter OTP
                              POST /verify-otp (in_progress→completed)
                              ⛔ 402 if payment_status ≠ 'paid' (server guard)
                              status = completed ──────────► ✅ Booking Done

── PAYMENT PHASE (Online — already paid at booking) ─────────────────────────
                                                ◄─────────── Click "✅ Mark Done"
                              POST /send-completion-otp
SMS: "OTP: 731042" ◄────────  [Production: send SMS to customer]
                              [Dev: shown in vendor dashboard]
Read OTP to vendor ──────────────────────────────────────► Enter OTP
                              status = completed ──────────► ✅ Booking Done
```

> **Why OTP-after-payment?** The completion OTP is the customer's "receipt". They pay → unlock the code → give to vendor. This means:
> - Vendor can't fake completion (no code without customer)
> - Customer can't refuse payment after service (code unlocked only after paying)
> - Both parties are protected

---

## 5. Tiffin Booking Flow (No OTP, Online Payment Only)

```
CUSTOMER                       SYSTEM                         VENDOR
──────────                     ──────                         ──────
Book listing ──────────────► POST /bookings
Address required ✓            status = pending
                                                ◄─────────── Accept booking
                              status = confirmed
                                                ◄─────────── Click "🛵 Out for Delivery"
                              PUT /status (out_for_delivery)
"🛵 Food on the way!" ◄──────  Realtime notification
                                                ◄─────────── Click "✅ Mark Delivered"
                              PUT /status (completed)
"✅ Order delivered!" ◄───────  Realtime notification
```

---

## 6. API Endpoints

| Method | Endpoint | Auth | Input | Output |
|--------|----------|------|-------|--------|
| `POST` | `/api/bookings` | Customer | `{ listing_id, scheduled_at, address, notes, payment_method }` | `{ booking }` |
| `GET` | `/api/bookings/mine` | Customer | `?status=` | `{ bookings[] }` with vendor UPI ID |
| `GET` | `/api/bookings/vendor` | Vendor | `?status=` | `{ bookings[] }` with customer profile |
| `PUT` | `/api/bookings/:id/status` | Vendor | `{ status }` | `{ booking }` |
| `POST` | `/api/bookings/:id/send-arrival-otp` | Vendor | — | `{ dev_otp }` (dev only) |
| `POST` | `/api/bookings/:id/send-completion-otp` | Vendor | — | `{ dev_otp }` (dev only) |
| `POST` | `/api/bookings/:id/verify-otp` | Vendor | `{ otp }` | `{ booking, message }` |
| `DELETE` | `/api/bookings/:id` | Customer | — | `{ message }` |

---

## 7. OTP Design

| Property | Value |
|---------|-------|
| Length | 6 digits |
| Generation | `crypto.randomInt(100000, 1000000)` — cryptographically secure |
| Expiry | 15 minutes |
| Storage | `bookings.completion_otp` (VARCHAR 6) + `bookings.otp_expires_at` |
| Reuse | Same column used for both arrival and completion OTPs (sequential, never overlap) |
| After use | Both fields set to `NULL` on successful verification |
| Dev mode | OTP returned in API response + logged to server console |
| Production | SMS via MSG91 (India) — TODO: wire up API key |

---

## 8. Status Transition Rules (Server-Enforced)

```
PUT /status allowed values: confirmed, out_for_delivery, completed, cancelled

Services (non-tiffin):
  ✅ confirmed → in_progress       via verify-otp only
  ✅ in_progress → completed       via verify-otp only
  ❌ out_for_delivery               blocked (tiffin only)
  ❌ completed without in_progress  blocked

Tiffin:
  ✅ confirmed → out_for_delivery
  ✅ out_for_delivery → completed
  ❌ in_progress                    not applicable
  ❌ completed without out_for_delivery  blocked
```

---

## 9. Real-time Notifications (Supabase Realtime)

Customer receives in-app toast when their booking status changes:

| Status Change | Toast Message |
|-------------|--------------|
| → `confirmed` | 🎉 Your booking has been confirmed! |
| → `in_progress` | 🔧 Service provider has arrived and started work! |
| → `out_for_delivery` | 🛵 Your food is on the way! |
| → `completed` | ✅ Booking completed. Thanks for using Veranda! |
| → `cancelled` | ❌ Your booking was cancelled by the vendor. |

Implementation: `useBookingRealtime(profileId)` hook — subscribes to `postgres_changes` on the `bookings` table filtered by `customer_id`.

---

## 9. Customer Dashboard — Status UI

| Status | Tab | Badge Color | Banner / Action |
|--------|-----|------------|--------|
| `pending` | Upcoming | Amber | — |
| `confirmed` | Confirmed | Green | — |
| `in_progress` | 🔧 In Progress | Amber | "Service is in progress" + `[📱 Pay via UPI Scan]` (COD only) |
| `out_for_delivery` | On the Way 🛵 | Pink | "Your food is on the way!" |
| `completed` | Completed | Blue | — |
| `cancelled` | Cancelled | Red | — |

---

## 10. Vendor Dashboard — Booking Card Actions

### Services Booking (Online Payment)
```
Status: pending     → [Accept] [Decline]
Status: confirmed   → [📍 I've Arrived]
                       ↓ (Arrival OTP sent to customer SMS / dev console)
                      [🔧 Dev OTP: 482917]
                      [Enter OTP ______] [Start ✓]
Status: in_progress → [✅ Mark Done]
                       ↓ (Completion OTP sent to customer SMS / dev console)
                      [🔵 Dev OTP: 731042]
                      [Enter OTP ______] [Done ✓]
Status: completed   → (no actions)
```

### Services Booking (COD Payment)
```
Status: in_progress → [✅ Mark Done]
                       ↓ (Completion OTP generated — stored in DB but NOT shown to vendor)
                      ⏳ "Ask customer to pay on Veranda app — they'll share the code"
                      [Enter OTP ______] [Done ✓]
                         ↑ customer pays → unlocks 6-digit code → reads to vendor
                         ⛔ Server: 402 if payment_status ≠ 'paid'
Status: completed   → (no actions)
```

> **Customer side (COD in_progress):**
> - Before payment: amber "📱 Pay ₹XXX via UPI / Card" pulsing button  
> - After payment: green box "Your completion code: **731042** — read to vendor"

### Tiffin Booking
```
Status: pending          → [Accept] [Decline]
Status: confirmed        → [🛵 Out for Delivery]
Status: out_for_delivery → [✅ Mark Delivered]
Status: completed        → (no actions)
```

---

## 11. Database Migrations Applied

| Migration File | Description |
|---------------|-------------|
| `20260528000000_booking_awaiting_confirmation.sql` | Added `awaiting_confirmation` to enum (deprecated) |
| `20260528000001_booking_out_for_delivery.sql` | Added `out_for_delivery` to enum |
| `20260528000002_booking_completion_otp.sql` | Added `completion_otp` + `otp_expires_at` columns |
| `20260528000003_booking_in_progress.sql` | Added `in_progress` to enum |
| `20260528000004_booking_razorpay_order_id.sql` | Added `razorpay_order_id` column |
| `20260528000005_booking_payment_method.sql` | Added `payment_method` column (online / cod) |
| `20260528000006_vendor_upi_id.sql` | Added `upi_id` to `vendor_profiles` for COD QR scan |

---

## 12. Security Considerations

- OTPs generated using `crypto.randomInt()` — NOT `Math.random()` (cryptographically secure)
- OTPs expire in 15 minutes
- OTPs stored as plaintext (short-lived, single-use — acceptable for this use case)
- OTPs cleared from DB immediately after successful verification
- Vendor can only verify OTPs for their own bookings (FK check)
- `dev_otp` is only returned when `NODE_ENV !== 'production'`
- All 500 errors use generic messages — raw DB errors never exposed to client
- Razorpay `create-order` blocked for COD bookings (guard prevents accidental charges)

---

## 13. Pending / Future Work

| Feature | Priority | Step |
|---------|----------|------|
| ~~Razorpay payment integration~~ | ✅ Done | Step 13 |
| ~~COD payment option~~ | ✅ Done | Step 13 |
| ~~UPI QR scanner for COD~~ | ✅ Done | Step 13 |
| MSG91 SMS integration (real OTP) | 🔴 High | Step 15 |
| Reviews & ratings after completed | 🟡 Medium | Step 14 |
| Vendor: "Mark Payment Received" for COD | 🟡 Medium | Step 13+ |
| Booking cancellation with refund | 🟡 Medium | Step 13+ |
| Admin dispute resolution | 🟢 Low | Later |
| Repeat/subscription bookings (tiffin monthly) | 🟢 Low | Later |
