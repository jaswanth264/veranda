const express = require('express');
const router = express.Router();
const { randomInt } = require('crypto');
const https = require('https');
const http = require('http');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const Razorpay = require('razorpay');

/**
 * Download an image from a URL (follows up to 5 redirects) and decode the QR code inside it.
 * Returns the raw QR string (e.g. "upi://pay?pa=...@razorpay&...") or null on failure.
 */
async function downloadBuffer(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'Veranda/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.destroy();
        return downloadBuffer(res.headers.location, redirectsLeft - 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function decodeQrImageUrl(imageUrl) {
  try {
    const buffer = await downloadBuffer(imageUrl);
    const png = PNG.sync.read(buffer);
    const code = jsQR(new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength), png.width, png.height);
    if (code?.data) {
      console.log('[bookings] QR decoded:', code.data.substring(0, 60) + '...');
      return code.data;
    }
    console.warn('[bookings] QR decoded but no data found');
    return null;
  } catch (e) {
    console.warn('[bookings] QR image decode failed:', e.message);
    return null;
  }
}
const { supabaseAdmin } = require('../supabase');
const { requireAuth } = require('../middleware/auth');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// In-memory store: bookingId → { qrId, baselineAmount }
// baselineAmount = payments_amount_received at the time QR was assigned to this booking
// Lets us detect NEW payments on a multi_use test QR
const codQrCodes = new Map();

function serverError(res, label, err) {
  console.error(`[bookings] ${label}:`, err?.message || err);
  return res.status(500).json({ error: 'Internal server error' });
}

// profiles.id is an auto-generated UUID; profiles.user_id = auth user UUID.
// This helper resolves the profiles.id for the logged-in user, creating the
// profile row if it was never created (e.g. legacy users without a trigger).
async function resolveProfileId(authUserId, userMeta) {
  // Try to find existing profile
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .single();

  if (existing) return { profileId: existing.id, error: null };

  // Auto-create missing profile
  const { data: created, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      user_id: authUserId,
      full_name: userMeta?.full_name || userMeta?.email?.split('@')[0] || 'User',
      phone: userMeta?.phone || null,
      role: userMeta?.role || 'customer',
    })
    .select('id')
    .single();

  if (error) return { profileId: null, error };
  return { profileId: created.id, error: null };
}

// ── POST /api/bookings ─ customer creates a booking ──────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { listing_id, scheduled_at, address, notes, payment_method } = req.body;

  if (!listing_id || !scheduled_at) {
    return res.status(400).json({ error: 'listing_id and scheduled_at are required' });
  }

  const validPaymentMethods = ['online', 'cod'];
  const resolvedPaymentMethod = validPaymentMethods.includes(payment_method) ? payment_method : 'online';

  // Resolve profiles.id (FK required by bookings.customer_id)
  const { profileId, error: profileErr } = await resolveProfileId(req.user.id, {
    ...req.user.user_metadata,
    email: req.user.email,
  });
  if (profileErr) return serverError(res, 'resolve-profile', profileErr);

  // Fetch listing to get vendor_id, price and category type
  const { data: listing, error: listingErr } = await supabaseAdmin
    .from('listings')
    .select('id, price, vendor_id, is_active, categories(type)')
    .eq('id', listing_id)
    .single();

  if (listingErr || !listing) return res.status(404).json({ error: 'Listing not found' });
  if (!listing.is_active) return res.status(400).json({ error: 'This listing is not available' });

  // Prevent vendor from booking their own listing
  const { data: myVendorProfile } = await supabaseAdmin
    .from('vendor_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single();

  if (myVendorProfile && myVendorProfile.id === listing.vendor_id) {
    return res.status(400).json({ error: 'You cannot book your own listing' });
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .insert({
      customer_id: profileId,
      listing_id,
      vendor_id: listing.vendor_id,
      scheduled_at,
      address: address || null,
      notes: notes || null,
      amount: listing.price,
      status: 'pending',
      payment_method: resolvedPaymentMethod,
      // COD bookings skip online payment — payment collected at doorstep after service
      payment_status: resolvedPaymentMethod === 'cod' ? 'cod_pending' : 'pending',
    })
    .select()
    .single();

  if (error) return serverError(res, 'create', error);
  res.status(201).json({ booking });
});

// ── GET /api/bookings/mine ─ customer sees their bookings ────────────────────
router.get('/mine', requireAuth, async (req, res) => {
  // Need profiles.id to filter bookings
  const { profileId, error: profileErr } = await resolveProfileId(req.user.id, {
    ...req.user.user_metadata,
    email: req.user.email,
  });
  if (profileErr) return serverError(res, 'resolve-profile-mine', profileErr);

  const { status } = req.query;

  let query = supabaseAdmin
    .from('bookings')
    .select(`
      *,
      listings(id, title, unit, categories(name, icon)),
      vendor_profiles(id, business_name, address)
    `)
    .eq('customer_id', profileId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return serverError(res, 'mine', error);
  res.json({ bookings: data });
});

// ── GET /api/bookings/vendor ─ vendor sees incoming bookings ─────────────────
router.get('/vendor', requireAuth, async (req, res) => {
  const { profileId: vpProfileId, error: vpProfileErr } = await resolveProfileId(req.user.id, {
    ...req.user.user_metadata,
    email: req.user.email,
  });
  if (vpProfileErr) return serverError(res, 'resolve-profile-vendor', vpProfileErr);

  const { data: vp } = await supabaseAdmin
    .from('vendor_profiles')
    .select('id')
    .eq('profile_id', vpProfileId)
    .single();

  if (!vp) return res.status(403).json({ error: 'Not a vendor' });

  const { status } = req.query;

  let query = supabaseAdmin
    .from('bookings')
    .select(`
      *,
      listings(id, title, unit, categories(name, icon)),
      profiles(id, full_name, phone)
    `)
    .eq('vendor_id', vp.id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return serverError(res, 'vendor-list', error);
  res.json({ bookings: data });
});

// ── PUT /api/bookings/:id/status ─ vendor updates booking status ─────────────
router.put('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;

  // in_progress is set only via POST /:id/verify-otp (arrival OTP flow)
  const VALID = ['confirmed', 'out_for_delivery', 'completed', 'cancelled'];
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID.join(', ')}` });
  }

  const { profileId: statusProfileId, error: statusProfileErr } = await resolveProfileId(req.user.id, {
    ...req.user.user_metadata,
    email: req.user.email,
  });
  if (statusProfileErr) return serverError(res, 'resolve-profile-status', statusProfileErr);

  const { data: vp } = await supabaseAdmin
    .from('vendor_profiles')
    .select('id')
    .eq('profile_id', statusProfileId)
    .single();

  if (!vp) return res.status(403).json({ error: 'Not a vendor' });

  // Enforce category-based workflow:
  // Services:  confirmed → in_progress (via OTP) → completed
  // Tiffin:    confirmed → out_for_delivery → completed
  if (status === 'out_for_delivery' || status === 'completed') {
    const { data: meta } = await supabaseAdmin
      .from('bookings')
      .select('status, listings(categories(type))')
      .eq('id', req.params.id)
      .single();

    const isTiffin = meta?.listings?.categories?.type === 'tiffin';
    const currentStatus = meta?.status;

    if (!isTiffin) {
      if (status === 'out_for_delivery') {
        return res.status(400).json({ error: 'Delivery status only applies to tiffin/food orders.' });
      }
      if (status === 'completed' && currentStatus !== 'in_progress') {
        return res.status(400).json({ error: 'Verify the arrival OTP to start the service before marking complete.' });
      }
    } else {
      if (status === 'completed' && currentStatus !== 'out_for_delivery') {
        return res.status(400).json({ error: 'Mark out for delivery before marking delivered.' });
      }
    }
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .update({ status })
    .eq('id', req.params.id)
    .eq('vendor_id', vp.id)
    .select()
    .single();

  if (error) return serverError(res, 'update-status', error);
  if (!booking) return res.status(404).json({ error: 'Booking not found or not yours' });
  res.json({ booking });
});

// ── DELETE /api/bookings/:id ─ customer cancels their booking ────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const { profileId, error: profileErr } = await resolveProfileId(req.user.id, {
    ...req.user.user_metadata,
    email: req.user.email,
  });
  if (profileErr) return serverError(res, 'resolve-profile-cancel', profileErr);

  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select('id, status, customer_id')
    .eq('id', req.params.id)
    .eq('customer_id', profileId)
    .single();

  if (fetchErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending bookings can be cancelled' });
  }

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id);

  if (error) return serverError(res, 'cancel', error);
  res.json({ message: 'Booking cancelled' });
});

// ── POST /api/bookings/:id/send-arrival-otp ─ vendor sends OTP to customer on arrival
router.post('/:id/send-arrival-otp', requireAuth, async (req, res) => {
  const { profileId, error: profileErr } = await resolveProfileId(req.user.id, {
    ...req.user.user_metadata,
    email: req.user.email,
  });
  if (profileErr) return serverError(res, 'resolve-profile-arrival-otp', profileErr);

  const { data: vp } = await supabaseAdmin
    .from('vendor_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single();
  if (!vp) return res.status(403).json({ error: 'Not a vendor' });

  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select('id, status, profiles(full_name, phone)')
    .eq('id', req.params.id)
    .eq('vendor_id', vp.id)
    .single();

  if (fetchErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'confirmed') {
    return res.status(400).json({ error: 'Arrival OTP can only be sent for confirmed bookings.' });
  }

  const otp = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: updateErr } = await supabaseAdmin
    .from('bookings')
    .update({ completion_otp: otp, otp_expires_at: expiresAt })
    .eq('id', req.params.id);

  if (updateErr) return serverError(res, 'send-arrival-otp', updateErr);

  // TODO production: await sendSms(booking.profiles?.phone, `Veranda: Your service provider has arrived. OTP: ${otp}. Share it to start the service.`);
  console.log(`\n🔑 [ARRIVAL OTP] Booking ${req.params.id} | Customer: ${booking.profiles?.full_name} (${booking.profiles?.phone || 'no phone'}) | OTP: ${otp} (valid 15 min)\n`);

  // In development, return the OTP in the response so it can be shown in the UI
  const responsePayload = { message: 'Arrival OTP sent to customer' };
  if (process.env.NODE_ENV !== 'production') responsePayload.dev_otp = otp;

  res.json(responsePayload);
});

// ── POST /api/bookings/:id/send-completion-otp ─ vendor sends OTP after job done
router.post('/:id/send-completion-otp', requireAuth, async (req, res) => {
  const { profileId, error: profileErr } = await resolveProfileId(req.user.id, {
    ...req.user.user_metadata,
    email: req.user.email,
  });
  if (profileErr) return serverError(res, 'resolve-profile-completion-otp', profileErr);

  const { data: vp } = await supabaseAdmin
    .from('vendor_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single();
  if (!vp) return res.status(403).json({ error: 'Not a vendor' });

  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select('id, status, profiles(full_name, phone)')
    .eq('id', req.params.id)
    .eq('vendor_id', vp.id)
    .single();

  if (fetchErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'in_progress') {
    return res.status(400).json({ error: 'Completion OTP can only be sent when service is in progress.' });
  }

  const otp = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: updateErr } = await supabaseAdmin
    .from('bookings')
    .update({ completion_otp: otp, otp_expires_at: expiresAt })
    .eq('id', req.params.id);

  if (updateErr) return serverError(res, 'send-completion-otp', updateErr);

  // TODO production: await sendSms(booking.profiles?.phone, `Veranda: Service done! OTP: ${otp}. Share it with the vendor to confirm completion.`);
  console.log(`\n✅ [COMPLETION OTP] Booking ${req.params.id} | Customer: ${booking.profiles?.full_name} (${booking.profiles?.phone || 'no phone'}) | OTP: ${otp} (valid 15 min)\n`);

  const responsePayload = { message: 'Completion OTP sent to customer' };
  if (process.env.NODE_ENV !== 'production') responsePayload.dev_otp = otp;

  res.json(responsePayload);
});

// ── POST /api/bookings/:id/verify-otp ─ vendor enters OTP from customer (arrival OR completion)
router.post('/:id/verify-otp', requireAuth, async (req, res) => {
  const { otp } = req.body;
  if (!otp) return res.status(400).json({ error: 'OTP is required' });

  const { profileId, error: profileErr } = await resolveProfileId(req.user.id, {
    ...req.user.user_metadata,
    email: req.user.email,
  });
  if (profileErr) return serverError(res, 'resolve-profile-verify-otp', profileErr);

  const { data: vp } = await supabaseAdmin
    .from('vendor_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single();
  if (!vp) return res.status(403).json({ error: 'Not a vendor' });

  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select('id, status, completion_otp, otp_expires_at, payment_method, payment_status')
    .eq('id', req.params.id)
    .eq('vendor_id', vp.id)
    .single();

  if (fetchErr || !booking) return res.status(404).json({ error: 'Booking not found' });

  // Allow OTP verify from confirmed (→ in_progress) or in_progress (→ completed)
  if (booking.status !== 'confirmed' && booking.status !== 'in_progress') {
    return res.status(400).json({ error: 'OTP verification is not applicable for this booking state.' });
  }

  // COD bookings complete via /confirm-cod-payment, not OTP
  if (booking.status === 'in_progress' && booking.payment_method === 'cod') {
    return res.status(400).json({ error: 'COD bookings are completed via the "Collect Payment" flow, not OTP.' });
  }
  if (!booking.completion_otp) {
    const hint = booking.status === 'confirmed' ? "Click \"I've Arrived\" first." : 'Click "Mark Done" first.';
    return res.status(400).json({ error: `No OTP sent yet. ${hint}` });
  }
  if (new Date() > new Date(booking.otp_expires_at)) {
    const hint = booking.status === 'confirmed' ? "Click \"I've Arrived\" to resend." : 'Click "Mark Done" to resend.';
    return res.status(400).json({ error: `OTP has expired (15 min). ${hint}` });
  }
  if (booking.completion_otp !== otp.toString().trim()) {
    return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
  }

  // confirmed → in_progress (arrival verified), in_progress → completed (job done verified)
  const nextStatus = booking.status === 'confirmed' ? 'in_progress' : 'completed';

  const { data: updated, error } = await supabaseAdmin
    .from('bookings')
    .update({ status: nextStatus, completion_otp: null, otp_expires_at: null })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return serverError(res, 'verify-otp', error);
  res.json({ booking: updated });
});

// ── POST /api/bookings/:id/confirm-cod-payment ─ vendor collects cash or UPI ─
// Called from vendor's CodPaymentModal after showing QR or receiving cash.
// Marks booking as paid + completed. No OTP needed for COD.
router.post('/:id/confirm-cod-payment', requireAuth, async (req, res) => {
  const { collected_via } = req.body; // 'cash' | 'upi'
  if (!collected_via || !['cash', 'upi'].includes(collected_via)) {
    return res.status(400).json({ error: 'collected_via must be cash or upi' });
  }

  const { profileId, error: profileErr } = await resolveProfileId(req.user.id, {
    ...req.user.user_metadata,
    email: req.user.email,
  });
  if (profileErr) return serverError(res, 'resolve-profile-cod-confirm', profileErr);

  const { data: vp } = await supabaseAdmin
    .from('vendor_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single();
  if (!vp) return res.status(403).json({ error: 'Not a vendor' });

  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select('id, status, payment_method, payment_status')
    .eq('id', req.params.id)
    .eq('vendor_id', vp.id)
    .single();

  if (fetchErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.payment_method !== 'cod') {
    return res.status(400).json({ error: 'This booking is not a COD booking.' });
  }
  if (booking.status !== 'in_progress') {
    return res.status(400).json({ error: 'Booking must be in_progress to collect payment.' });
  }
  if (booking.payment_status === 'paid') {
    return res.status(400).json({ error: 'Payment already confirmed for this booking.' });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'completed',
      payment_status: 'paid',
      completion_otp: null,
      otp_expires_at: null,
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return serverError(res, 'confirm-cod-payment', error);
  console.log(`[bookings] COD payment confirmed (${collected_via}) for booking ${req.params.id}`);
  res.json({ booking: updated, message: `Payment collected via ${collected_via}. Booking completed.` });
});

// ── POST /api/bookings/:id/create-cod-payment-link ────────────────────────
// Creates a Razorpay UPI QR Code for the booking amount.
// Razorpay assigns a unique VPA (e.g. pay.veranda.qr_xxx@razorpay) to this QR.
// Customer scans → native GPay/PhonePe opens immediately → enters PIN → pays.
// No browser redirect. Auto-detected via polling /check-cod-payment.
router.post('/:id/create-cod-payment-link', requireAuth, async (req, res) => {
  const { profileId, error: profileErr } = await resolveProfileId(req.user.id, {
    ...req.user.user_metadata,
    email: req.user.email,
  });
  if (profileErr) return serverError(res, 'resolve-profile-cod-qr', profileErr);

  const { data: vp } = await supabaseAdmin
    .from('vendor_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .single();
  if (!vp) return res.status(403).json({ error: 'Not a vendor' });

  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select('id, amount, status, payment_method, payment_status, listings(title)')
    .eq('id', req.params.id)
    .eq('vendor_id', vp.id)
    .single();

  if (fetchErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.payment_method !== 'cod') return res.status(400).json({ error: 'Not a COD booking' });
  if (booking.status !== 'in_progress') return res.status(400).json({ error: 'Booking must be in_progress' });
  if (booking.payment_status === 'paid') return res.status(400).json({ error: 'Already paid' });

  // ── Dev mode: reuse a pre-created test QR from the dashboard ─────────────
  // Set RAZORPAY_TEST_QR_ID in server/.env to skip creating a new QR each time.
  // In production (NODE_ENV=production) this is ignored.
  if (process.env.NODE_ENV !== 'production' && process.env.RAZORPAY_TEST_QR_ID) {
    try {
      const testQr = await razorpay.qrCode.fetch(process.env.RAZORPAY_TEST_QR_ID);
      // Record the current total so we can detect NEW payments for this booking
      const baseline = testQr.payments_amount_received || 0;
      codQrCodes.set(req.params.id, { qrId: testQr.id, baselineAmount: baseline });
      console.log(`[bookings] Using test QR ${testQr.id} (baseline ₹${baseline / 100}) for booking ${req.params.id}`);
      const upiString = await decodeQrImageUrl(testQr.image_url);
      return res.json({ qr_id: testQr.id, image_url: testQr.image_url, upi_string: upiString });
    } catch (err) {
      console.warn('[bookings] Test QR fetch failed, falling through to create new:', err?.error?.description);
    }
  }

  // Reuse existing QR if still active
  const existingQrId = codQrCodes.get(req.params.id);
  if (existingQrId) {
    try {
      const existing = await razorpay.qrCode.fetch(existingQrId);
      if (existing.status === 'active') {
        return res.json({ qr_id: existing.id, image_url: existing.image_url });
      }
    } catch (_) { /* QR gone, create new */ }
  }

  let qr;
  try {
    // Razorpay UPI QR Code — assigns a unique VPA per booking.
    // Customer scans → GPay/PhonePe opens natively (no browser redirect) → PIN entry.
    qr = await razorpay.qrCode.create({
      type: 'upi_qr',
      name: 'Veranda',
      usage: 'single_use',           // auto-closes after one payment
      fixed_amount: true,
      payment_amount: Math.round(Number(booking.amount) * 100), // paise
      description: `Veranda: ${booking.listings?.title || 'Service'}`,
      close_by: Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
    });
  } catch (err) {
    return serverError(res, 'razorpay-create-qr', err);
  }

  codQrCodes.set(req.params.id, { qrId: qr.id, baselineAmount: 0 });
  console.log(`[bookings] Created UPI QR ${qr.id} for booking ${req.params.id}`);
  const upiStringProd = await decodeQrImageUrl(qr.image_url);
  res.json({ qr_id: qr.id, image_url: qr.image_url, upi_string: upiStringProd });
});

// ── GET /api/bookings/:id/check-cod-payment ────────────────────────────────
// Polled by vendor's CodPaymentModal every 3s.
// Checks if the Razorpay UPI QR has received payment; if so → auto-completes booking.
router.get('/:id/check-cod-payment', requireAuth, async (req, res) => {
  const entry = codQrCodes.get(req.params.id);
  if (!entry) return res.json({ completed: false });

  const { qrId, baselineAmount } = entry;

  let qr;
  try {
    qr = await razorpay.qrCode.fetch(qrId);
  } catch (err) {
    return serverError(res, 'razorpay-fetch-qr', err);
  }

  // For single_use QRs: paid = payments_amount_received > 0
  // For multi_use test QRs: paid = current total > baseline (new payment arrived)
  const paid = (qr.payments_amount_received || 0) > baselineAmount;

  if (paid) {
    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'completed', payment_status: 'paid', completion_otp: null, otp_expires_at: null })
      .eq('id', req.params.id);

    if (!error) {
      codQrCodes.delete(req.params.id);
      console.log(`[bookings] Auto-completed booking ${req.params.id} via UPI QR payment`);
    }
    return res.json({ completed: true });
  }

  res.json({ completed: false, qr_status: qr.status });
});

module.exports = router;
