-- =====================================================
-- CREATE WORKING RLS POLICIES FOR PRODUCTS TABLE
-- =====================================================

-- First, ensure RLS is enabled on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (just in case)
DROP POLICY IF EXISTS "products_select_policy" ON products;
DROP POLICY IF EXISTS "products_insert_policy" ON products;
DROP POLICY IF EXISTS "products_update_policy" ON products;
DROP POLICY IF EXISTS "products_delete_policy" ON products;

-- =====================================================
-- SELECT POLICY: Only authenticated users can view products
-- =====================================================
CREATE POLICY "products_select_policy" ON products
    FOR SELECT
    USING (
        -- Only authenticated users can view products
        auth.uid() IS NOT NULL
    );

-- =====================================================
-- INSERT POLICY: Only authenticated nelayan can create products
-- =====================================================
CREATE POLICY "products_insert_policy" ON products
    FOR INSERT
    WITH CHECK (
        -- Must be authenticated
        auth.uid() IS NOT NULL
        AND
        -- Must be a nelayan (fisherman)
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'nelayan'
        )
        AND
        -- Can only create products for themselves
        nelayan_id = auth.uid()
    );

-- =====================================================
-- UPDATE POLICY: Only product owner can update their products
-- =====================================================
CREATE POLICY "products_update_policy" ON products
    FOR UPDATE
    USING (
        -- Must be authenticated
        auth.uid() IS NOT NULL
        AND
        -- Can only update own products
        nelayan_id = auth.uid()
    )
    WITH CHECK (
        -- Must be authenticated
        auth.uid() IS NOT NULL
        AND
        -- Can only update own products
        nelayan_id = auth.uid()
        AND
        -- Cannot change ownership
        nelayan_id = (SELECT nelayan_id FROM products WHERE id = products.id)
    );

-- =====================================================
-- DELETE POLICY: Only product owner can delete their products
-- =====================================================
CREATE POLICY "products_delete_policy" ON products
    FOR DELETE
    USING (
        -- Must be authenticated
        auth.uid() IS NOT NULL
        AND
        -- Can only delete own products
        nelayan_id = auth.uid()
    );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled
SELECT 
    'RLS Status:' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'products';

-- Check created policies
SELECT 
    'Created Policies:' as info,
    policyname,
    cmd as operation,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY cmd, policyname;

-- Test auth functions
SELECT 
    'Auth Functions Test:' as info,
    'auth.uid() = ' || COALESCE(auth.uid()::text, 'NULL') as uid_result,
    'auth.role() = ' || COALESCE(auth.role()::text, 'NULL') as role_result;

-- Count total products (should work for authenticated users)
SELECT 
    'Total Products:' as info,
    COUNT(*) as total_count
FROM products;