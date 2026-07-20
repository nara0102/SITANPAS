-- =====================================================
-- FIX RLS POLICIES AND MISSING COLUMNS
-- =====================================================

-- Add missing nama_lengkap column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nama_lengkap TEXT;

-- Drop existing problematic RLS policies on users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow admin to manage website settings" ON public.website_settings;

-- Create simple, non-recursive RLS policies for users
CREATE POLICY "Allow users to view all profiles" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Allow users to update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow users to insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create simple admin policy for website_settings without recursion
CREATE POLICY "Allow admin to manage website settings" ON public.website_settings
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'admin' OR
        auth.uid() IN (
            SELECT id FROM public.users WHERE role = 'admin'
        )
    );

-- Update existing users to have nama_lengkap = full_name if null
UPDATE public.users SET nama_lengkap = full_name WHERE nama_lengkap IS NULL AND full_name IS NOT NULL;