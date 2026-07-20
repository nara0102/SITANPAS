-- =====================================================
-- COMPLETE FIX FOR RLS AND COLUMNS
-- =====================================================

-- Disable RLS temporarily to fix policies
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Allow users to view all profiles" ON public.users;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.users;
DROP POLICY IF EXISTS "Allow admin to manage website settings" ON public.website_settings;
DROP POLICY IF EXISTS "Allow public read access to website settings" ON public.website_settings;

-- Add missing columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nama_lengkap TEXT;

-- Update existing data
UPDATE public.users SET nama_lengkap = COALESCE(full_name, email) WHERE nama_lengkap IS NULL;

-- Re-enable RLS with simple policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

-- Simple non-recursive policies for users
CREATE POLICY "users_select_policy" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert_policy" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update_policy" ON public.users FOR UPDATE USING (true);
CREATE POLICY "users_delete_policy" ON public.users FOR DELETE USING (true);

-- Simple policies for website_settings
CREATE POLICY "website_settings_select_policy" ON public.website_settings FOR SELECT USING (true);
CREATE POLICY "website_settings_insert_policy" ON public.website_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "website_settings_update_policy" ON public.website_settings FOR UPDATE USING (true);
CREATE POLICY "website_settings_delete_policy" ON public.website_settings FOR DELETE USING (true);