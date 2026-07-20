-- =====================================================
-- COMPREHENSIVE RLS DIAGNOSIS - ROOT CAUSE ANALYSIS
-- =====================================================

-- 1. Check if RLS is actually enabled at table level
SELECT 
    'Table RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as status
FROM pg_tables 
WHERE tablename = 'products';

-- 2. Check ALL policies on products table
SELECT 
    'All Policies' as check_type,
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
    qual as using_condition,
    with_check as with_check_condition
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY cmd, policyname;

-- 3. Check current database role and permissions
SELECT 
    'Current Database Role' as check_type,
    current_user as db_user,
    session_user as session_user,
    current_role as current_role,
    CASE 
        WHEN current_user = 'postgres' THEN '⚠️ SUPERUSER - BYPASSES RLS'
        WHEN current_user LIKE '%service_role%' THEN '⚠️ SERVICE ROLE - BYPASSES RLS'
        ELSE '✅ REGULAR USER'
    END as role_status;

-- 4. Check if current role bypasses RLS
SELECT 
    'RLS Bypass Check' as check_type,
    rolname,
    rolbypassrls,
    CASE 
        WHEN rolbypassrls THEN '⚠️ BYPASSES RLS'
        ELSE '✅ RESPECTS RLS'
    END as bypass_status
FROM pg_roles 
WHERE rolname = current_user;

-- 5. Check auth schema functions availability
SELECT 
    'Auth Functions Check' as check_type,
    proname as function_name,
    pronargs as arg_count,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
AND proname IN ('role', 'uid', 'jwt')
ORDER BY proname;

-- 6. Test auth functions directly
SELECT 
    'Auth Function Test' as check_type,
    auth.role() as auth_role,
    auth.uid() as auth_uid,
    CASE 
        WHEN auth.role() IS NULL THEN '❌ AUTH.ROLE() RETURNS NULL'
        WHEN auth.uid() IS NULL THEN '❌ AUTH.UID() RETURNS NULL'
        ELSE '✅ AUTH FUNCTIONS WORKING'
    END as auth_function_status;

-- 7. Check table ownership and permissions
SELECT 
    'Table Ownership' as check_type,
    schemaname,
    tablename,
    tableowner,
    CASE 
        WHEN tableowner = 'postgres' THEN '⚠️ OWNED BY POSTGRES'
        ELSE '✅ OWNED BY: ' || tableowner
    END as ownership_status
FROM pg_tables 
WHERE tablename = 'products';

-- 8. Check if there are any conflicting policies
SELECT 
    'Policy Conflicts' as check_type,
    COUNT(*) as total_policies,
    COUNT(CASE WHEN cmd = 'r' THEN 1 END) as select_policies,
    COUNT(CASE WHEN cmd = 'w' THEN 1 END) as update_policies,
    CASE 
        WHEN COUNT(CASE WHEN cmd = 'r' THEN 1 END) > 1 THEN '⚠️ MULTIPLE SELECT POLICIES'
        WHEN COUNT(CASE WHEN cmd = 'w' THEN 1 END) > 1 THEN '⚠️ MULTIPLE UPDATE POLICIES'
        ELSE '✅ NO CONFLICTS'
    END as conflict_status
FROM pg_policies 
WHERE tablename = 'products';

-- 9. Test a simple RLS policy manually
-- This will help us understand if RLS is working at all
DO $$
BEGIN
    -- Try to create a test table with RLS
    DROP TABLE IF EXISTS rls_test;
    CREATE TABLE rls_test (
        id SERIAL PRIMARY KEY,
        user_id UUID,
        data TEXT
    );
    
    -- Enable RLS
    ALTER TABLE rls_test ENABLE ROW LEVEL SECURITY;
    
    -- Create a simple policy
    CREATE POLICY "test_policy" ON rls_test
        FOR ALL
        USING (user_id = auth.uid());
    
    -- Insert test data
    INSERT INTO rls_test (user_id, data) VALUES 
        ('00000000-0000-0000-0000-000000000001', 'Test Data 1'),
        ('00000000-0000-0000-0000-000000000002', 'Test Data 2');
    
    RAISE NOTICE 'RLS Test Table Created Successfully';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS Test Failed: %', SQLERRM;
END $$;

-- 10. Check the test table
SELECT 
    'RLS Test Results' as check_type,
    COUNT(*) as visible_rows,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ RLS WORKING - NO ROWS VISIBLE'
        ELSE '❌ RLS NOT WORKING - ' || COUNT(*) || ' ROWS VISIBLE'
    END as rls_test_status
FROM rls_test;

-- Clean up test table
DROP TABLE IF EXISTS rls_test;

-- 11. Final recommendation
SELECT 
    'Diagnosis Summary' as check_type,
    'Check the results above to identify the root cause' as message,
    'Look for: SUPERUSER roles, NULL auth functions, or missing policies' as recommendation;