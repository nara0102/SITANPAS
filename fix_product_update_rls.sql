-- Fix RLS policy for product updates to prevent cross-user updates
-- This ensures nelayan can only update their own products

-- Drop existing update policy
DROP POLICY IF EXISTS "Nelayan can update own products" ON public.products;

-- Create new policy with proper WITH CHECK clause
CREATE POLICY "Nelayan can update own products" ON public.products
    FOR UPDATE
    USING (
        nelayan_id = auth.uid() AND
        nelayan_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    )
    WITH CHECK (
        nelayan_id = auth.uid() AND
        nelayan_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- Verify the policy is working
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'products' AND cmd = 'UPDATE';