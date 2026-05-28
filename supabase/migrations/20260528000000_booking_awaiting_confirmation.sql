-- Add 'awaiting_confirmation' to booking_status enum
-- Industry workflow: vendor marks done → customer must confirm → completed
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'awaiting_confirmation' AFTER 'confirmed';
