-- =====================================================
-- STRICT RLS POLICIES - COMPLETE ACCESS CONTROL
-- =====================================================

-- First, drop all existing policies to start fresh
DROP POLICY IF EXISTS "products_select_policy" ON products;
DROP POLICY IF EXISTS "products_insert_policy" ON products;
DROP POLICY IF EXISTS "products_update_policy" ON products;
DROP POLICY IF EXISTS "products_delete_policy" ON products;

-- Ensure RLS is enabled
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICY 1: SELECT - Only authenticated users can view products
-- =====================================================
CREATE POLICY "products_select_authenticated_only" ON products
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- =====================================================
-- POLICY 2: INSERT - Only authenticated nelayan can create products
-- =====================================================
CREATE POLICY "products_insert_authenticated_nelayan" ON products
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' 
        AND auth.uid() IS NOT NULL
        AND nelayan_id = auth.uid()
    );

-- =====================================================
-- POLICY 3: UPDATE - Only product owner can update
-- =====================================================
CREATE POLICY "products_update_owner_only" ON products
    FOR UPDATE
    USING (
        auth.role() = 'authenticated' 
        AND auth.uid() IS NOT NULL
        AND nelayan_id = auth.uid()
    )
    WITH CHECK (
        auth.role() = 'authenticated' 
        AND auth.uid() IS NOT NULL
        AND nelayan_id = auth.uid()
    );

-- =====================================================
-- POLICY 4: DELETE - Only product owner can delete
-- =====================================================
CREATE POLICY "products_delete_owner_only" ON products
    FOR DELETE
    USING (
        auth.role() = 'authenticated' 
        AND auth.uid() IS NOT NULL
        AND nelayan_id = auth.uid()
    );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '✅ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as rls_status
FROM pg_tables 
WHERE tablename = 'products';

-- Check all policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    CASE 
        WHEN cmd = 'r' THEN 'SELECT'
        WHEN cmd = 'a' THEN 'INSERT'
        WHEN cmd = 'w' THEN 'UPDATE'
        WHEN cmd = 'd' THEN 'DELETE'
        ELSE cmd
    END as operation,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY cmd, policyname;

-- Test auth functions
SELECT 
    'Auth Role Check' as test,
    auth.role() as current_role,
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✅ AUTHENTICATED'
        WHEN auth.role() = 'anon' THEN '⚠️ ANONYMOUS'
        ELSE '❓ UNKNOWN: ' || COALESCE(auth.role()::text, 'NULL')
    END as auth_status;

-- Count products (this should fail for unauthenticated users)
SELECT 
    'Product Count Test' as test,
    COUNT(*) as total_products,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ CAN ACCESS PRODUCTS'
        ELSE '❌ NO ACCESS TO PRODUCTS'
    END as access_status
FROM products;

-- Show sample products (this should fail for unauthenticated users)
SELECT 
    'Sample Products' as test,
    id,
    nama_produk,
    nelayan_id,
    created_at
FROM products 
LIMIT 3;

COMMIT;