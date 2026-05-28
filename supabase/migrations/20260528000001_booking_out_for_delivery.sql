-- Add 'out_for_delivery' to booking_status enum
-- Used for tiffin/food: vendor dispatches food (via Rapido, self-delivery, etc.)
-- Flow: confirmed → out_for_delivery → completed
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'out_for_delivery' AFTER 'awaiting_confirmation';
