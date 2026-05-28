-- Add OTP fields for Urban Company-style service completion verification
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completion_otp VARCHAR(6);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
