-- =====================================================
-- CRITICAL RLS SECURITY FIX
-- =====================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can update own products" ON public.products;
DROP POLICY IF EXISTS "Admin can update all products" ON public.products;

-- =====================================================
-- SECURE PRODUCTS TABLE POLICIES
-- =====================================================

-- Only authenticated users can view active products
CREATE POLICY "Authenticated users can view active products" ON public.products
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND 
        status = 'active'
    );

-- Admin can view all products
CREATE POLICY "Admin can view all products" ON public.products
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Nelayan can view their own products (including inactive)
CREATE POLICY "Nelayan can view own products" ON public.products
    FOR SELECT
    USING (
        nelayan_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- Nelayan can ONLY update their own products with strict validation
CREATE POLICY "Nelayan can update own products only" ON public.products
    FOR UPDATE
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

-- Admin can update all products with proper validation
CREATE POLICY "Admin can update all products" ON public.products
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

-- =====================================================
-- SECURE ORDERS TABLE POLICIES
-- =====================================================

-- Drop existing policies that might be too permissive
DROP POLICY IF EXISTS "Public can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders" ON public.orders;

-- Only authenticated users can create orders
CREATE POLICY "Authenticated users can create orders" ON public.orders
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.products 
            WHERE id = produk_id AND status = 'active'
        )
    );

-- Nelayan can view orders for their products only
CREATE POLICY "Nelayan can view orders for own products" ON public.orders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.users u ON p.nelayan_id = u.id
            WHERE p.id = orders.produk_id 
            AND u.id = auth.uid() 
            AND u.role = 'nelayan'
        )
    );

-- Admin can view all orders
CREATE POLICY "Admin can view all orders" ON public.orders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Nelayan can update orders for their products only
CREATE POLICY "Nelayan can update orders for own products" ON public.orders
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.users u ON p.nelayan_id = u.id
            WHERE p.id = orders.produk_id 
            AND u.id = auth.uid() 
            AND u.role = 'nelayan'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.users u ON p.nelayan_id = u.id
            WHERE p.id = orders.produk_id 
            AND u.id = auth.uid() 
            AND u.role = 'nelayan'
        )
    );

-- =====================================================
-- VERIFY RLS IS ENABLED
-- =====================================================

-- Ensure RLS is enabled on all critical tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (security enhancement)
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;