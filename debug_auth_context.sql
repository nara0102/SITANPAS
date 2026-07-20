-- =====================================================
-- DEBUG AUTH CONTEXT AND RLS POLICIES
-- =====================================================

-- Test 1: Check if auth functions work
SELECT 
    'Testing auth functions' as test_name,
    auth.uid() as current_auth_uid,
    auth.role() as current_auth_role,
    current_user as postgres_user,
    session_user as session_user;

-- Test 2: Check current policies on products table
SELECT 
    'Current RLS Policies' as info,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'products' 
ORDER BY policyname;

-- Test 3: Check if RLS is enabled
SELECT 
    'RLS Status' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'products';

-- Test 4: Check users table structure and data
SELECT 
    'Users table check' as info,
    id,
    email,
    role,
    status,
    full_name
FROM public.users 
WHERE role = 'nelayan'
LIMIT 5;

-- Test 5: Test a simple RLS policy manually
-- This will help us understand if the issue is with auth.uid() or policy logic
DO $$
DECLARE
    test_uid UUID;
    policy_result BOOLEAN;
BEGIN
    -- Get a test user ID
    SELECT id INTO test_uid FROM public.users WHERE role = 'nelayan' LIMIT 1;
    
    IF test_uid IS NOT NULL THEN
        RAISE NOTICE 'Test user ID: %', test_uid;
        
        -- Test the policy logic manually
        SELECT (nelayan_id = test_uid) INTO policy_result
        FROM public.products 
        WHERE nelayan_id = test_uid 
        LIMIT 1;
        
        RAISE NOTICE 'Manual policy test result: %', policy_result;
    ELSE
        RAISE NOTICE 'No nelayan users found for testing';
    END IF;
END $$;

-- Test 6: Check if there are any conflicting policies or settings
SELECT 
    'Database settings' as info,
    name,
    setting
FROM pg_settings 
WHERE name IN ('row_security', 'log_statement', 'log_min_messages');