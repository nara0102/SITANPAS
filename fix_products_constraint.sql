-- =====================================================
-- FIX PRODUCTS TABLE CONSTRAINT FOR USER DELETION
-- Jalankan script ini di Supabase Dashboard > SQL Editor
-- =====================================================

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS products_nelayan_id_fkey;

-- Step 2: Modify the nelayan_id column to allow NULL values
ALTER TABLE public.products 
ALTER COLUMN nelayan_id DROP NOT NULL;

-- Step 3: Add back the foreign key constraint with CASCADE delete
ALTER TABLE public.products 
ADD CONSTRAINT products_nelayan_id_fkey 
FOREIGN KEY (nelayan_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 4: Update the admin_delete_user_with_audit function to handle NULL nelayan_id properly
CREATE OR REPLACE FUNCTION admin_delete_user_with_audit(
    target_user_id UUID,
    admin_user_id UUID DEFAULT auth.uid(),
    deletion_reason TEXT DEFAULT 'Admin deletion'
)
RETURNS BOOLEAN AS $$
DECLARE
    target_user_record RECORD;
    current_admin_id UUID;
BEGIN
    -- Use provided admin_user_id or fallback to auth.uid()
    current_admin_id := COALESCE(admin_user_id, auth.uid());
    
    -- Check if admin user has admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = current_admin_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only admin users can delete users. Current user role check failed.';
    END IF;

    -- Get target user data for audit
    SELECT * INTO target_user_record
    FROM public.users 
    WHERE id = target_user_id;

    -- Check if user was found
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user not found with ID: %', target_user_id;
    END IF;

    -- Prevent admin from deleting other admins
    IF target_user_record.role = 'admin' THEN
        RAISE EXCEPTION 'Cannot delete admin users';
    END IF;

    -- Create audit log before deletion
    INSERT INTO public.deleted_users_audit (
        deleted_user_id,
        deleted_user_email,
        deleted_user_role,
        deleted_by,
        deletion_reason,
        user_data
    ) VALUES (
        target_user_id,
        target_user_record.email,
        target_user_record.role,
        current_admin_id,
        deletion_reason,
        row_to_json(target_user_record)::jsonb
    );

    -- Delete related data first (cascade delete)
    DELETE FROM public.pending_nelayan WHERE user_id = target_user_id;
    
    -- Update products to preserve order history (nelayan_id will be set to NULL automatically by CASCADE)
    UPDATE public.products 
    SET status = 'inactive', 
        updated_at = NOW(),
        deskripsi = COALESCE(deskripsi || ' | ', '') || 'Nelayan account deleted on ' || NOW()::date
    WHERE nelayan_id = target_user_id;
    
    -- Update transactions to preserve history
    UPDATE public.transactions 
    SET admin_notes = COALESCE(admin_notes || ' | ', '') || 'Nelayan account deleted on ' || NOW()::date
    WHERE nelayan_id = target_user_id;

    -- Delete the user from public.users (this will automatically set nelayan_id to NULL in products)
    DELETE FROM public.users WHERE id = target_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_delete_user_with_audit(UUID, UUID, TEXT) TO authenticated;

-- Step 5: Update RLS policies to handle NULL nelayan_id
-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Nelayan can view own products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can update own products" ON public.products;

-- Recreate policies with NULL handling
CREATE POLICY "Nelayan can view own products" ON public.products
    FOR SELECT
    USING (
        nelayan_id = auth.uid() AND
        nelayan_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

CREATE POLICY "Nelayan can update own products" ON public.products
    FOR UPDATE
    USING (
        nelayan_id = auth.uid() AND
        nelayan_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- Add policy for viewing products with NULL nelayan_id (deleted users)
CREATE POLICY "Admin can view products with deleted nelayan" ON public.products
    FOR SELECT
    USING (
        nelayan_id IS NULL AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Verify the changes
SELECT 
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'products' 
AND column_name = 'nelayan_id';

-- =====================================================
-- CONSTRAINT FIXED - Ready for testing
-- =====================================================