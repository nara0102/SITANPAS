-- Add unit_type and berat_per_box columns to products table
-- This allows fishermen to sell products by kilogram or by box

-- Add unit_type column with enum values
DO $$ 
BEGIN
    -- Create enum type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_type') THEN
        CREATE TYPE unit_type AS ENUM ('kg', 'box');
    END IF;
END $$;

-- Add columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit_type unit_type DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS berat_per_box NUMERIC;

-- Add check constraint for berat_per_box
ALTER TABLE public.products 
ADD CONSTRAINT check_berat_per_box 
CHECK (berat_per_box IS NULL OR berat_per_box > 0);

-- Add comment for documentation
COMMENT ON COLUMN public.products.unit_type IS 'Unit penjualan: kg (per kilogram) atau box (per box)';
COMMENT ON COLUMN public.products.berat_per_box IS 'Berat per box dalam kilogram (hanya untuk unit_type = box)';

-- Update existing products to have default unit_type
UPDATE public.products 
SET unit_type = 'kg' 
WHERE unit_type IS NULL;