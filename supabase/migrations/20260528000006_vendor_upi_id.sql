-- Add UPI ID to vendor_profiles for COD QR scanner payments
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS upi_id TEXT;

COMMENT ON COLUMN vendor_profiles.upi_id IS 'Vendor UPI ID for COD doorstep payments via QR scan (e.g. name@okaxis)';
