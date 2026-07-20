-- =====================================================
-- MISSING ADMIN FUNCTIONS
-- =====================================================
-- This migration adds the missing update_product_stock_admin function
-- that is referenced in the TypeScript types but missing from the database

-- Function to update product stock (admin only)
CREATE OR REPLACE FUNCTION update_product_stock_admin(
    product_id UUID,
    new_stock INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the user is an admin
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Update the product stock
    UPDATE public.products
    SET 
        stok = new_stock,
        updated_at = NOW(),
        -- Reactivate product if stock is added and it was inactive due to no stock
        status = CASE 
            WHEN new_stock > 0 AND status = 'inactive' THEN 'active'
            WHEN new_stock = 0 THEN 'inactive'
            ELSE status
        END
    WHERE id = product_id;

    -- Check if the product exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product with ID % not found', product_id;
    END IF;
END;
$$;

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION update_product_stock_admin TO authenticated;
GRANT EXECUTE ON FUNCTION update_product_stock_admin TO anon;

-- Refresh schema cache to make function available immediately
NOTIFY pgrst, 'reload schema';