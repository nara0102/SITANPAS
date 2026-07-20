-- =====================================================
-- FINAL RLS SECURITY FIX - CRITICAL ISSUES
-- =====================================================

-- First, drop all existing problematic policies
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Admin can view all products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can view own products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can create products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can update own products" ON public.products;
DROP POLICY IF EXISTS "Admin can update all products" ON public.products;
DROP POLICY IF EXISTS "Admin can delete products" ON public.products;

-- Drop problematic order policies
DROP POLICY IF EXISTS "Public can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Nelayan can view orders for their products" ON public.orders;
DROP POLICY IF EXISTS "Admin can update all orders" ON public.orders;

-- =====================================================
-- SECURE PRODUCTS TABLE POLICIES
-- =====================================================

-- Only authenticated users can view active products (public marketplace)
CREATE POLICY "Authenticated users can view active products" ON public.products
    FOR SELECT
    USING (
        status = 'active' AND (
            auth.uid() IS NOT NULL OR
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role = 'admin'
            )
        )
    );

-- Nelayan can view ALL their own products (including inactive)
CREATE POLICY "Nelayan can view own products" ON public.products
    FOR SELECT
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
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only authenticated nelayan can create products
CREATE POLICY "Nelayan can create products" ON public.products
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
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

-- Admin can update all products
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

-- Admin can delete products
CREATE POLICY "Admin can delete products" ON public.products
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- SECURE ORDERS TABLE POLICIES
-- =====================================================

-- Anyone can create orders for active products (marketplace functionality)
CREATE POLICY "Anyone can create orders for active products" ON public.orders
    FOR INSERT
    WITH CHECK (
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

-- Admin can update all orders
CREATE POLICY "Admin can update all orders" ON public.orders
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
-- SECURE TRANSACTIONS TABLE POLICIES
-- =====================================================

-- Drop existing transaction policies
DROP POLICY IF EXISTS "Admin can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Nelayan can view own transactions" ON public.transactions;

-- Nelayan can view transactions for their products only
CREATE POLICY "Nelayan can view own transactions" ON public.transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.products p ON o.produk_id = p.id
            WHERE o.id = transactions.order_id 
            AND p.nelayan_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role = 'nelayan'
            )
        )
    );

-- Admin can view all transactions
CREATE POLICY "Admin can view all transactions" ON public.transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- FORCE RLS AND SECURITY ENHANCEMENTS
-- =====================================================

-- Ensure RLS is enabled and forced on all critical tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (critical security)
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- =====================================================
-- ADD SECURITY FUNCTIONS
-- =====================================================

-- Function to check if user owns a product
CREATE OR REPLACE FUNCTION public.user_owns_product(product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.products 
        WHERE id = product_id 
        AND nelayan_id = auth.uid()
    );
END;
$$;

-- Function to check if user can access order
CREATE OR REPLACE FUNCTION public.user_can_access_order(order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.products p ON o.produk_id = p.id
        WHERE o.id = order_id 
        AND p.nelayan_id = auth.uid()
    );
END;
$$;