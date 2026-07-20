-- =====================================================
-- STRICT FIX FOR PRODUCT UPDATE RLS POLICY
-- =====================================================

-- Drop the existing update policies
DROP POLICY IF EXISTS "Nelayan can update own products" ON public.products;
DROP POLICY IF EXISTS "Admin can update all products" ON public.products;

-- Create a very strict policy for nelayan updates
CREATE POLICY "Nelayan can update own products" ON public.products
    FOR UPDATE
    USING (
        -- Must be the owner
        nelayan_id = auth.uid() AND
        -- nelayan_id cannot be NULL
        nelayan_id IS NOT NULL AND
        -- Must be a nelayan user
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    )
    WITH CHECK (
        -- Ensure nelayan_id doesn't change and remains the same user
        nelayan_id = auth.uid() AND
        -- nelayan_id cannot be NULL
        nelayan_id IS NOT NULL AND
        -- Must be a nelayan user
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        ) AND
        -- Additional check: ensure the original nelayan_id matches current user
        nelayan_id = (
            SELECT nelayan_id FROM public.products 
            WHERE id = products.id
        )
    );

-- Admin can update all products (separate policy)
CREATE POLICY "Admin can update all products" ON public.products
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );