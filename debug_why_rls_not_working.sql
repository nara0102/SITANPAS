-- =====================================================
-- DEBUG WHY RLS IS NOT WORKING
-- =====================================================

-- 1. Check if RLS is actually enabled
SELECT 
    'RLS Status Check:' as test,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'products';

-- 2. Check all existing policies
SELECT 
    'All Policies:' as test,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_expression,
    with_check
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY cmd, policyname;

-- 3. Test auth functions in current context
SELECT 
    'Auth Context:' as test,
    'auth.uid() = ' || COALESCE(auth.uid()::text, 'NULL') as current_uid,
    'auth.role() = ' || COALESCE(auth.role()::text, 'NULL') as current_role;

-- 4. Check if there are any bypass settings
SELECT 
    'Database Settings:' as test,
    name,
    setting
FROM pg_settings 
WHERE name IN ('row_security', 'log_statement', 'log_min_messages');

-- 5. Test a simple RLS policy manually
-- This will help us understand if the issue is with policy logic or RLS itself
SELECT 
    'Manual Policy Test:' as test,
    id,
    nelayan_id,
    nama_produk,
    'auth.uid() IS NOT NULL = ' || (auth.uid() IS NOT NULL)::text as auth_check,
    'nelayan_id = auth.uid() = ' || (nelayan_id = auth.uid())::text as ownership_check
FROM products 
LIMIT 3;

-- 6. Check if we're running as superuser (which bypasses RLS)
SELECT 
    'User Privileges:' as test,
    current_user as current_db_user,
    session_user as session_db_user,
    usesuper as is_superuser
FROM pg_user 
WHERE usename = current_user;

-- 7. Check if there are any conflicting policies or permissions
SELECT 
    'Table Permissions:' as test,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'products'
AND grantee IN ('anon', 'authenticated', 'service_role');

-- 8. Test if RLS can be bypassed by role
SELECT 
    'Role Bypass Check:' as test,
    rolname,
    rolsuper,
    rolbypassrls
FROM pg_roles 
WHERE rolname IN ('postgres', 'anon', 'authenticated', 'service_role', current_user);