-- Remove berat_per_box column from products table
-- Since box units don't require weight information, this field is no longer needed

-- Drop the check constraint first
ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS check_berat_per_box;

-- Drop the berat_per_box column
ALTER TABLE public.products 
DROP COLUMN IF EXISTS berat_per_box;