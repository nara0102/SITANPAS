-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_nelayan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

-- Admin can see all users
CREATE POLICY "Admin can view all users" ON public.users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT
    USING (id = auth.uid());

-- Admin can update all users
CREATE POLICY "Admin can update all users" ON public.users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() AND 
        role = (SELECT role FROM public.users WHERE id = auth.uid()) -- Prevent role change
    );

-- New users can be inserted (handled by trigger)
CREATE POLICY "Allow user creation" ON public.users
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- PENDING NELAYAN TABLE POLICIES
-- =====================================================

-- Admin can view all pending applications
CREATE POLICY "Admin can view all pending applications" ON public.pending_nelayan
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view their own application
CREATE POLICY "Users can view own application" ON public.pending_nelayan
    FOR SELECT
    USING (user_id = auth.uid());

-- Authenticated users can create application
CREATE POLICY "Users can create nelayan application" ON public.pending_nelayan
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'customer_guest'
        )
    );

-- Admin can update applications (for approval/rejection)
CREATE POLICY "Admin can update applications" ON public.pending_nelayan
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- PRODUCTS TABLE POLICIES
-- =====================================================

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

-- Nelayan can update their own products
CREATE POLICY "Nelayan can update own products" ON public.products
    FOR UPDATE
    USING (
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
-- ORDERS TABLE POLICIES
-- =====================================================

-- Public can create orders (no authentication required)
CREATE POLICY "Public can create orders" ON public.orders
    FOR INSERT
    WITH CHECK (true);

-- Admin can view all orders
CREATE POLICY "Admin can view all orders" ON public.orders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Nelayan can view orders for their products
CREATE POLICY "Nelayan can view orders for their products" ON public.orders
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

-- Admin can update all orders
CREATE POLICY "Admin can update all orders" ON public.orders
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Nelayan can update orders for their products (limited fields)
CREATE POLICY "Nelayan can update orders for their products" ON public.orders
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.users u ON p.nelayan_id = u.id
            WHERE p.id = orders.produk_id 
            AND u.id = auth.uid() 
            AND u.role = 'nelayan'
        )
    );

-- =====================================================
-- TRANSACTIONS TABLE POLICIES
-- =====================================================

-- Admin can view all transactions
CREATE POLICY "Admin can view all transactions" ON public.transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Nelayan can view their own transactions
CREATE POLICY "Nelayan can view own transactions" ON public.transactions
    FOR SELECT
    USING (
        nelayan_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- System can create transactions (handled by trigger)
CREATE POLICY "System can create transactions" ON public.transactions
    FOR INSERT
    WITH CHECK (true);

-- Admin can update all transactions
CREATE POLICY "Admin can update all transactions" ON public.transactions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Nelayan can update their own transactions (limited fields)
CREATE POLICY "Nelayan can update own transactions" ON public.transactions
    FOR UPDATE
    USING (
        nelayan_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- =====================================================
-- ADDITIONAL SECURITY FUNCTIONS
-- =====================================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is nelayan
CREATE OR REPLACE FUNCTION is_nelayan()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'nelayan'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
DECLARE
    user_role_result user_role;
BEGIN
    SELECT role INTO user_role_result
    FROM public.users 
    WHERE id = auth.uid();
    
    RETURN COALESCE(user_role_result, 'customer_guest');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT SELECT ON public.products TO anon; -- Public can view products
GRANT INSERT ON public.orders TO anon;   -- Public can create orders

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant specific permissions for service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;