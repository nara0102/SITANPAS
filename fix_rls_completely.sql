-- =====================================================
-- COMPLETE RLS FIX FOR PRODUCTS TABLE
-- =====================================================

-- First, disable RLS temporarily to clean up
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on products table
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Admin can view all products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can view own products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can create products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can update own products" ON public.products;
DROP POLICY IF EXISTS "Admin can update all products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can delete own products" ON public.products;
DROP POLICY IF EXISTS "Admin can delete all products" ON public.products;

-- Re-enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE NEW SIMPLIFIED RLS POLICIES
-- =====================================================

-- 1. SELECT Policies
-- Public can view active products
CREATE POLICY "products_select_public" ON public.products
    FOR SELECT
    USING (status = 'active');

-- Nelayan can view their own products (including inactive)
CREATE POLICY "products_select_owner" ON public.products
    FOR SELECT
    USING (nelayan_id = auth.uid());

-- Admin can view all products
CREATE POLICY "products_select_admin" ON public.products
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 2. INSERT Policies
-- Only nelayan can create products for themselves
CREATE POLICY "products_insert_nelayan" ON public.products
    FOR INSERT
    WITH CHECK (
        nelayan_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- 3. UPDATE Policies
-- Nelayan can only update their own products
CREATE POLICY "products_update_owner" ON public.products
    FOR UPDATE
    USING (nelayan_id = auth.uid())
    WITH CHECK (nelayan_id = auth.uid());

-- Admin can update any product
CREATE POLICY "products_update_admin" ON public.products
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 4. DELETE Policies
-- Nelayan can delete their own products
CREATE POLICY "products_delete_owner" ON public.products
    FOR DELETE
    USING (nelayan_id = auth.uid());

-- Admin can delete any product
CREATE POLICY "products_delete_admin" ON public.products
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- VERIFY POLICIES ARE CREATED
-- =====================================================

-- Check all policies on products table
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'products' 
ORDER BY policyname;

-- Check RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'products';

-- =====================================================
-- POLICIES RECREATED - READY FOR TESTING
-- =====================================================