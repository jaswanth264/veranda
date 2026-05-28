const express = require('express');
const router = express.Router();
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

  // Fetch listing to get vendor_id and price
  const { data: listing, error: listingErr } = await supabaseAdmin
    .from('listings')
    .select('id, price, vendor_id, is_active')
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
      customer_id: profileId,        // profiles.id  (auto UUID)
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
  const ALLOWED = ['confirmed', 'completed', 'cancelled'];
  if (!ALLOWED.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${ALLOWED.join(', ')}` });
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

module.exports = router;
