-- =====================================================
-- FIX DUPLICATE RLS POLICIES
-- =====================================================

-- Drop all existing policies on products table to avoid conflicts
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Admin can view all products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can view own products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can create products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can update own products" ON public.products;
DROP POLICY IF EXISTS "Admin can update all products" ON public.products;
DROP POLICY IF EXISTS "Admin can delete products" ON public.products;
DROP POLICY IF EXISTS "Admin can view products with deleted nelayan" ON public.products;

-- Recreate policies with proper constraints
-- Everyone can view active products (public access)
CREATE POLICY "Public can view active products" ON public.products
    FOR SELECT
    USING (status = 'active');

-- Admin can view all products
CREATE POLICY "Admin can view all products" ON public.products
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Nelayan can view their own products
CREATE POLICY "Nelayan can view own products" ON public.products
    FOR SELECT
    USING (
        nelayan_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- Nelayan can create products
CREATE POLICY "Nelayan can create products" ON public.products
    FOR INSERT
    WITH CHECK (
        nelayan_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- Nelayan can update their own products (with proper WITH CHECK clause)
CREATE POLICY "Nelayan can update own products" ON public.products
    FOR UPDATE
    USING (
        nelayan_id = auth.uid() AND
        nelayan_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    )
    WITH CHECK (
        nelayan_id = auth.uid() AND
        nelayan_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- Admin can update all products
CREATE POLICY "Admin can update all products" ON public.products
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admin can delete products
CREATE POLICY "Admin can delete products" ON public.products
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admin can view products with deleted nelayan
CREATE POLICY "Admin can view products with deleted nelayan" ON public.products
    FOR SELECT
    USING (
        nelayan_id IS NULL AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );