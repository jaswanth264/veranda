-- Add Razorpay order ID to bookings for payment verification
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
