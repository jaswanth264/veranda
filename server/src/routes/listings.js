const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const { requireAuth } = require('../middleware/auth');

// Helper: get vendor_profile for a user
async function getVendorProfile(userId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();
  if (!profile) return null;

  const { data: vendor } = await supabaseAdmin
    .from('vendor_profiles')
    .select('id')
    .eq('profile_id', profile.id)
    .single();
  return vendor || null;
}

// ─────────────────────────────────────────
// POST /api/listings
// Create a listing (vendor only)
// ─────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const vendor = await getVendorProfile(req.user.id);
    if (!vendor) return res.status(403).json({ error: 'Vendor profile required to create listings' });

    const { title, description, category_id, price, unit, images } = req.body;

    if (!title || !category_id || price === undefined) {
      return res.status(400).json({ error: 'title, category_id and price are required' });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }

    // Verify category exists
    const { data: category } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('id', category_id)
      .single();
    if (!category) return res.status(400).json({ error: 'Invalid category_id' });

    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .insert({
        vendor_id:   vendor.id,
        category_id: parseInt(category_id),
        title:       title.trim(),
        description: description?.trim() || null,
        price:       parsedPrice,
        unit:        unit?.trim() || 'per visit',
        images:      Array.isArray(images) ? images : [],
      })
      .select('*, categories(id, name, icon, type)')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ listing });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create listing' });
  }
});

// ─────────────────────────────────────────
// GET /api/listings/mine
// Vendor's own listings (must be before /:id)
// ─────────────────────────────────────────
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const vendor = await getVendorProfile(req.user.id);
    if (!vendor) return res.status(403).json({ error: 'Vendor profile not found' });

    const { data, error } = await supabaseAdmin
      .from('listings')
      .select('*, categories(id, name, icon, type)')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ listings: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// ─────────────────────────────────────────
// GET /api/listings
// Public — browse active listings
// Query params: ?category=tiffin&page=1&limit=10
// ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const from = (pageNum - 1) * limitNum;
    const to   = from + limitNum - 1;

    let query = supabaseAdmin
      .from('listings')
      .select(`
        *,
        categories!inner(id, name, icon, type),
        vendor_profiles(id, business_name, address, lat, lng, rating, total_reviews, is_verified, is_featured)
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (category) {
      query = query.eq('categories.type', category);
    }

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      listings: data,
      pagination: { page: pageNum, limit: limitNum, total: count },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// ─────────────────────────────────────────
// GET /api/listings/category/:type
// Public — filter by category type
// ─────────────────────────────────────────
router.get('/category/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (!['services', 'tiffin'].includes(type)) {
      return res.status(400).json({ error: 'type must be "services" or "tiffin"' });
    }

    const { data, error } = await supabaseAdmin
      .from('listings')
      .select(`
        *,
        categories!inner(id, name, icon, type),
        vendor_profiles(id, business_name, address, rating, is_verified)
      `)
      .eq('is_active', true)
      .eq('categories.type', type)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ listings: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// ─────────────────────────────────────────
// GET /api/listings/:id
// Public — single listing detail
// ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('listings')
      .select(`
        *,
        categories(id, name, icon, type),
        vendor_profiles(id, business_name, description, address, lat, lng, rating, total_reviews, is_verified, is_featured)
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Listing not found' });

    return res.json({ listing: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// ─────────────────────────────────────────
// PUT /api/listings/:id
// Update own listing (vendor only)
// ─────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const vendor = await getVendorProfile(req.user.id);
    if (!vendor) return res.status(403).json({ error: 'Vendor profile not found' });

    const { id } = req.params;
    const { title, description, category_id, price, unit, images, is_active } = req.body;

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('listings')
      .select('id')
      .eq('id', id)
      .eq('vendor_id', vendor.id)
      .single();
    if (!existing) return res.status(404).json({ error: 'Listing not found or not yours' });

    const updates = {};
    if (title)            updates.title       = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (category_id)      updates.category_id = parseInt(category_id);
    if (price !== undefined) {
      const p = parseFloat(price);
      if (!isNaN(p) && p >= 0) updates.price = p;
    }
    if (unit)             updates.unit        = unit.trim();
    if (Array.isArray(images)) updates.images = images;
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data, error } = await supabaseAdmin
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select('*, categories(id, name, icon, type)')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ listing: data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update listing' });
  }
});

// ─────────────────────────────────────────
// DELETE /api/listings/:id
// Soft-delete (deactivate) own listing
// ─────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const vendor = await getVendorProfile(req.user.id);
    if (!vendor) return res.status(403).json({ error: 'Vendor profile not found' });

    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('listings')
      .select('id')
      .eq('id', id)
      .eq('vendor_id', vendor.id)
      .single();
    if (!existing) return res.status(404).json({ error: 'Listing not found or not yours' });

    await supabaseAdmin
      .from('listings')
      .update({ is_active: false })
      .eq('id', id);

    return res.json({ message: 'Listing deactivated' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to deactivate listing' });
  }
});

module.exports = router;
