-- =====================================================
-- DEBUG RLS POLICIES AND AUTH
-- =====================================================

-- Check current RLS policies on products table
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
WHERE tablename = 'products' 
ORDER BY policyname;

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'products';

-- Test auth.uid() function
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role;

-- Check current user context
SELECT 
    current_user,
    session_user,
    current_setting('role') as current_role_setting;

-- Test RLS policy evaluation
-- This will show what auth.uid() returns in different contexts
DO $$
BEGIN
    RAISE NOTICE 'Current auth.uid(): %', auth.uid();
    RAISE NOTICE 'Current auth.role(): %', auth.role();
END $$;