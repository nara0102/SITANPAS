-- =====================================================
-- FIX CRITICAL RLS SECURITY ISSUES
-- =====================================================

-- First, drop all existing policies on products table
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Admin can view all products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can view own products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can create products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can update own products" ON public.products;
DROP POLICY IF EXISTS "Admin can update all products" ON public.products;
DROP POLICY IF EXISTS "Admin can delete products" ON public.products;

-- =====================================================
-- SECURE PRODUCTS TABLE POLICIES
-- =====================================================

-- 1. SELECT Policies - Restrict access properly
-- Anonymous users can view active products (marketplace access)
CREATE POLICY "Anonymous can view active products" ON public.products
    FOR SELECT
    TO anon
    USING (status = 'active');

-- Authenticated users can view active products
CREATE POLICY "Authenticated can view active products" ON public.products
    FOR SELECT
    TO authenticated
    USING (status = 'active');

-- Nelayan can view their own products (including inactive)
CREATE POLICY "Nelayan can view own products" ON public.products
    FOR SELECT
    TO authenticated
    USING (
        nelayan_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- Admin can view all products
CREATE POLICY "Admin can view all products" ON public.products
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 2. INSERT Policies - Only nelayan can create products
CREATE POLICY "Nelayan can create products" ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (
        nelayan_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- Admin can create products (for any nelayan)
CREATE POLICY "Admin can create products" ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 3. UPDATE Policies - Strict ownership and role checking
CREATE POLICY "Nelayan can update own products" ON public.products
    FOR UPDATE
    TO authenticated
    USING (
        nelayan_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    )
    WITH CHECK (
        nelayan_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- Admin can update all products
CREATE POLICY "Admin can update all products" ON public.products
    FOR UPDATE
    TO authenticated
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

-- 4. DELETE Policies - Only admin can delete
CREATE POLICY "Admin can delete products" ON public.products
    FOR DELETE
    TO authenticated
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
    'RLS Policies Verification' as info,
    policyname,
    cmd,
    permissive,
    roles,
    qual as using_condition,
    with_check as with_check_condition
FROM pg_policies 
WHERE tablename = 'products' 
ORDER BY cmd, policyname;

-- Check RLS is enabled
SELECT 
    'RLS Status' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'products';

-- =====================================================
-- SECURITY POLICIES FIXED
-- =====================================================