-- Add cod_pending to payment_status enum
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'cod_pending';
