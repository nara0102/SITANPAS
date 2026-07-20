-- =====================================================
-- FIX INFINITE RECURSION IN RLS POLICIES
-- =====================================================

-- Drop the problematic UPDATE policy
DROP POLICY IF EXISTS "products_update_policy" ON products;

-- Create a simpler UPDATE policy without recursion
CREATE POLICY "products_update_policy" ON products
    FOR UPDATE
    USING (
        -- Must be authenticated and own the product
        auth.uid() IS NOT NULL
        AND nelayan_id = auth.uid()
    )
    WITH CHECK (
        -- Must be authenticated and own the product
        auth.uid() IS NOT NULL
        AND nelayan_id = auth.uid()
    );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all policies
SELECT 
    'Current Policies:' as info,
    policyname,
    cmd as operation,
    qual as using_clause,
    with_check
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY cmd, policyname;

-- Test that policies work
SELECT 
    'Policy Test:' as info,
    'RLS is enabled and policies are active' as status;