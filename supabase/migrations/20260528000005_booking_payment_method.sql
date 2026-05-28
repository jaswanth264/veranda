-- Add payment_method to bookings: 'online' (Razorpay) or 'cod' (Pay at Doorstep)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) NOT NULL DEFAULT 'online'
  CHECK (payment_method IN ('online', 'cod'));
