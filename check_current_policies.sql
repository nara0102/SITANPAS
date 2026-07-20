-- Check current RLS policies for products table
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
WHERE tablename = 'products';

-- Check if RLS is enabled on products table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'products';

-- Test auth.uid() function directly
SELECT 
    'Current auth.uid():' as info,
    auth.uid() as current_user_id;

-- Test auth.role() function
SELECT 
    'Current auth.role():' as info,
    auth.role() as current_role;

-- Check if there are any users in auth.users
SELECT 
    'Total users in auth.users:' as info,
    COUNT(*) as count
FROM auth.users;

-- Check products table structure and sample data
SELECT 
    'Products table sample:' as info,
    id,
    nama_produk,
    nelayan_id,
    created_at
FROM products 
LIMIT 3;