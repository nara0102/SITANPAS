-- =====================================================
-- FINAL FIX: UPDATE POLICY - BLOCK CROSS-USER ACCESS
-- =====================================================

-- Drop the problematic UPDATE policy
DROP POLICY IF EXISTS "products_update_owner_only" ON products;

-- Create a more restrictive UPDATE policy
CREATE POLICY "products_update_strict_owner_only" ON products
    FOR UPDATE
    TO authenticated
    USING (nelayan_id = auth.uid())
    WITH CHECK (nelayan_id = auth.uid());

-- Also ensure we have the correct SELECT policy
DROP POLICY IF EXISTS "products_select_authenticated_only" ON products;

CREATE POLICY "products_select_authenticated_only" ON products
    FOR SELECT
    TO authenticated
    USING (true);

-- Verification queries
SELECT 
    'RLS Status Check' as test,
    schemaname,
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '✅ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as rls_status
FROM pg_tables 
WHERE tablename = 'products';

-- Check UPDATE policy specifically
SELECT 
    'UPDATE Policy Check' as test,
    policyname,
    cmd,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'products' AND cmd = 'w'
ORDER BY policyname;

-- Test current auth context
SELECT 
    'Current Auth Context' as test,
    auth.role() as current_role,
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✅ AUTHENTICATED'
        WHEN auth.role() = 'anon' THEN '⚠️ ANONYMOUS'
        ELSE '❓ UNKNOWN: ' || COALESCE(auth.role()::text, 'NULL')
    END as auth_status;

COMMIT;