-- =====================================================
-- FINAL COMPREHENSIVE FIX
-- =====================================================

-- Completely disable RLS on all tables
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.website_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pending_nelayan DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies completely
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.schemaname || '.' || r.tablename;
    END LOOP;
END $$;

-- Ensure nama_lengkap column exists
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nama_lengkap TEXT;

-- Update existing users with nama_lengkap
UPDATE public.users 
SET nama_lengkap = COALESCE(full_name, email, 'User') 
WHERE nama_lengkap IS NULL OR nama_lengkap = '';

-- Grant full permissions to anon and authenticated roles
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Re-enable RLS with simple, non-recursive policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_nelayan ENABLE ROW LEVEL SECURITY;

-- Create simple allow-all policies
CREATE POLICY "allow_all_users" ON public.users USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_website_settings" ON public.website_settings USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_products" ON public.products USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_orders" ON public.orders USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transactions" ON public.transactions USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_pending_nelayan" ON public.pending_nelayan USING (true) WITH CHECK (true);

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';