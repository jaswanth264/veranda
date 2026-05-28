const express = require('express');
const router = express.Router();
const { randomInt } = require('crypto');
const { supabaseAdmin } = require('../supabase');
const { requireAuth } = require('../middleware/auth');

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
  const { listing_id, scheduled_at, address, notes } = req.body;

  if (!listing_id || !scheduled_at) {
    return res.status(400).json({ error: 'listing_id and scheduled_at are required' });
  }

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
    .select('id, status, completion_otp, otp_expires_at')
    .eq('id', req.params.id)
    .eq('vendor_id', vp.id)
    .single();

  if (fetchErr || !booking) return res.status(404).json({ error: 'Booking not found' });

  // Allow OTP verify from confirmed (→ in_progress) or in_progress (→ completed)
  if (booking.status !== 'confirmed' && booking.status !== 'in_progress') {
    return res.status(400).json({ error: 'OTP verification is not applicable for this booking state.' });
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

module.exports = router;
