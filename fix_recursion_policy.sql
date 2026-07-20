-- =====================================================
-- FIX INFINITE RECURSION IN RLS POLICY
-- =====================================================

-- Drop the problematic update policies
DROP POLICY IF EXISTS "Nelayan can update own products" ON public.products;
DROP POLICY IF EXISTS "Admin can update all products" ON public.products;

-- Create a simplified policy for nelayan updates (without recursion)
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