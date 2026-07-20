-- =====================================================
-- FIX TABLE PERMISSIONS
-- =====================================================

-- Grant permissions to anon and authenticated roles for website_settings
GRANT SELECT ON public.website_settings TO anon;
GRANT ALL PRIVILEGES ON public.website_settings TO authenticated;

-- Grant permissions to anon and authenticated roles for products
GRANT SELECT ON public.products TO anon;
GRANT ALL PRIVILEGES ON public.products TO authenticated;

-- Grant permissions to anon and authenticated roles for users
GRANT SELECT ON public.users TO anon;
GRANT ALL PRIVILEGES ON public.users TO authenticated;

-- Grant permissions to anon and authenticated roles for orders
GRANT SELECT, INSERT, UPDATE ON public.orders TO anon;
GRANT ALL PRIVILEGES ON public.orders TO authenticated;

-- Grant permissions to anon and authenticated roles for transactions
GRANT SELECT, INSERT, UPDATE ON public.transactions TO anon;
GRANT ALL PRIVILEGES ON public.transactions TO authenticated;

-- Grant permissions to anon and authenticated roles for pending_nelayan
GRANT SELECT, INSERT ON public.pending_nelayan TO anon;
GRANT ALL PRIVILEGES ON public.pending_nelayan TO authenticated;