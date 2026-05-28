const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const { createHmac } = require('crypto');
const { supabaseAdmin } = require('../supabase');
const { requireAuth } = require('../middleware/auth');

function serverError(res, label, err) {
  console.error(`[payments] ${label}:`, err?.message || err);
  return res.status(500).json({ error: 'Internal server error' });
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── POST /api/payments/create-order ─────────────────────────────────────────
// Called after booking is created. Returns a Razorpay order to open checkout.
router.post('/create-order', requireAuth, async (req, res) => {
  const { booking_id } = req.body;
  if (!booking_id) return res.status(400).json({ error: 'booking_id is required' });

  // Resolve customer's profiles.id
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('user_id', req.user.id)
    .single();
  if (!profile) return res.status(400).json({ error: 'Profile not found' });

  // Verify booking belongs to this customer and is unpaid
  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select('id, amount, payment_status, payment_method, status, listings(title)')
    .eq('id', booking_id)
    .eq('customer_id', profile.id)
    .single();

  if (fetchErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.payment_status === 'paid') {
    return res.status(400).json({ error: 'This booking is already paid.' });
  }
  // COD bookings can pay via Razorpay at doorstep — allowed only when service is in_progress
  if (booking.payment_method === 'cod' && booking.status !== 'in_progress') {
    return res.status(400).json({ error: 'COD payment is only accepted once the service has started.' });
  }

  // Create Razorpay order — amount in paise (₹1 = 100 paise)
  let order;
  try {
    order = await razorpay.orders.create({
      amount: Math.round(parseFloat(booking.amount) * 100),
      currency: 'INR',
      receipt: booking_id.slice(0, 40), // Razorpay receipt max 40 chars
      notes: { booking_id, listing: booking.listings?.title || '' },
    });
  } catch (err) {
    return serverError(res, 'razorpay-create-order', err);
  }

  // Save order ID to booking for later signature verification
  const { error: updateErr } = await supabaseAdmin
    .from('bookings')
    .update({ razorpay_order_id: order.id })
    .eq('id', booking_id);

  if (updateErr) return serverError(res, 'save-order-id', updateErr);

  res.json({
    order_id: order.id,
    amount: order.amount,       // paise
    currency: order.currency,
    key_id: process.env.RAZORPAY_KEY_ID,
    booking_id,
  });
});

// ── POST /api/payments/verify ────────────────────────────────────────────────
// Verifies Razorpay HMAC signature and marks booking as paid.
router.post('/verify', requireAuth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !booking_id) {
    return res.status(400).json({ error: 'Missing required payment verification fields.' });
  }

  // Verify HMAC-SHA256 signature: order_id|payment_id signed with key_secret
  const hmac = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const expectedSignature = hmac.digest('hex');

  if (expectedSignature !== razorpay_signature) {
    console.warn(`[payments] Signature mismatch for booking ${booking_id}`);
    return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
  }

  // Resolve customer's profiles.id for ownership check
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('user_id', req.user.id)
    .single();
  if (!profile) return res.status(400).json({ error: 'Profile not found' });

  // Update booking: mark paid, store payment_id
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .update({ payment_id: razorpay_payment_id, payment_status: 'paid' })
    .eq('id', booking_id)
    .eq('customer_id', profile.id)
    .eq('razorpay_order_id', razorpay_order_id) // extra safety check
    .select()
    .single();

  if (error || !booking) return serverError(res, 'mark-paid', error);

  console.log(`✅ [Payment] Booking ${booking_id} paid — Razorpay ID: ${razorpay_payment_id}`);
  res.json({ booking, message: 'Payment successful' });
});

// ── POST /api/payments/webhook ─────────────────────────────────────────────
// Razorpay webhook — listens for payment_link.paid events.
// This auto-completes COD bookings without waiting for the vendor to tap a button.
//
// Setup in production:
//   Razorpay Dashboard → Settings → Webhooks → add URL: https://your-domain/api/payments/webhook
//   Select events: payment_link.paid
//   Set a secret and add it to server/.env as RAZORPAY_WEBHOOK_SECRET
//
// Raw body needed for signature verification — ensure this route is NOT
// wrapped by express.json() before it. (index.js registers /api/payments AFTER
// express.json, so the body parser runs first. For webhooks, Razorpay sends
// raw JSON — express.json() still parses it correctly, but req.rawBody is not
// available by default. We use the JSON body for signature check here.)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  // If no secret configured (local dev), skip verification
  if (secret && signature) {
    const hmac = createHmac('sha256', secret);
    hmac.update(req.body); // req.body is a Buffer because of express.raw
    const expected = hmac.digest('hex');
    if (expected !== signature) {
      console.warn('[payments/webhook] Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (payload.event === 'payment_link.paid') {
    const linkId = payload.payload?.payment_link?.entity?.id;
    const amountPaid = payload.payload?.payment?.entity?.amount; // in paise

    if (linkId) {
      // Find bookings where this payment link was used.
      // We match via bookings that are in_progress + cod + payment link id
      // stored in our in-memory map (bookings.js). Since routes are separate
      // modules, we look this up via the shared supabaseAdmin call with a
      // known tag approach — OR simply log and let polling handle it.
      // For production: store payment_link_id in the DB column.
      console.log(`[payments/webhook] payment_link.paid — linkId=${linkId} amount=${amountPaid}`);
      // Note: Completion is handled by /check-cod-payment polling in bookings.js.
      // The polling will detect the 'paid' status from Razorpay on the next poll.
    }
  }

  res.json({ received: true });
});

module.exports = router;
