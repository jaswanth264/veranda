-- Add in_progress status: vendor has arrived and service is actively underway
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'confirmed';
