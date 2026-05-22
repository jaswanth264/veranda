const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const { requireAuth } = require('../middleware/auth');

// Helper: get profile_id from user_id
async function getProfileId(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data;
}

// ─────────────────────────────────────────
// POST /api/vendor/profile
// Create vendor profile (vendor role only)
// ─────────────────────────────────────────
router.post('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await getProfileId(req.user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (profile.role !== 'vendor') return res.status(403).json({ error: 'Only vendors can create a vendor profile' });

    const { business_name, description, category, address, lat, lng } = req.body;

    if (!business_name || !category) {
      return res.status(400).json({ error: 'business_name and category are required' });
    }

    if (!['services', 'tiffin'].includes(category)) {
      return res.status(400).json({ error: 'category must be "services" or "tiffin"' });
    }

    // Check if already exists
    const { data: existing } = await supabaseAdmin
      .from('vendor_profiles')
      .select('id')
      .eq('profile_id', profile.id)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Vendor profile already exists. Use PUT to update.' });
    }

    const { data: vendorProfile, error } = await supabaseAdmin
      .from('vendor_profiles')
      .insert({
        profile_id: profile.id,
        business_name: business_name.trim(),
        description: description?.trim() || null,
        category,
        address: address?.trim() || null,
        lat: lat || null,
        lng: lng || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Audit log (non-blocking)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    supabaseAdmin.from('audit_logs').insert({
      profile_id: profile.id,
      event: 'vendor_profile_created',
      metadata: { business_name, category },
      ip_address: ip,
    }).then(() => {});

    return res.status(201).json({ vendor_profile: vendorProfile });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create vendor profile' });
  }
});

// ─────────────────────────────────────────
// GET /api/vendor/profile/me
// Get own vendor profile
// ─────────────────────────────────────────
router.get('/profile/me', requireAuth, async (req, res) => {
  try {
    const profile = await getProfileId(req.user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { data, error } = await supabaseAdmin
      .from('vendor_profiles')
      .select('*')
      .eq('profile_id', profile.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Vendor profile not found' });

    return res.json({ vendor_profile: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch vendor profile' });
  }
});

// ─────────────────────────────────────────
// PUT /api/vendor/profile
// Update own vendor profile
// ─────────────────────────────────────────
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await getProfileId(req.user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { business_name, description, category, address, lat, lng } = req.body;

    if (category && !['services', 'tiffin'].includes(category)) {
      return res.status(400).json({ error: 'category must be "services" or "tiffin"' });
    }

    const updates = {};
    if (business_name) updates.business_name = business_name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (category) updates.category = category;
    if (address !== undefined) updates.address = address?.trim() || null;
    if (lat !== undefined) updates.lat = lat;
    if (lng !== undefined) updates.lng = lng;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data, error } = await supabaseAdmin
      .from('vendor_profiles')
      .update(updates)
      .eq('profile_id', profile.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Vendor profile not found' });

    return res.json({ vendor_profile: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update vendor profile' });
  }
});

// ─────────────────────────────────────────
// GET /api/vendor/:id
// Public — get any vendor's profile
// ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('vendor_profiles')
      .select('id, business_name, description, category, address, lat, lng, rating, total_reviews, is_verified, is_featured, created_at')
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Vendor not found' });

    return res.json({ vendor: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

module.exports = router;
