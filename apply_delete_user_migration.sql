-- =====================================================
-- DEPLOY ADMIN DELETE USER FUNCTIONALITY
-- Jalankan script ini di Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Create audit log table for deleted users
CREATE TABLE IF NOT EXISTS public.deleted_users_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_user_id UUID NOT NULL,
    deleted_user_email TEXT,
    deleted_user_role user_role,
    deleted_by UUID NOT NULL,
    deletion_reason TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_data JSONB -- Store user data for audit purposes
);

-- Enable RLS on audit table
ALTER TABLE public.deleted_users_audit ENABLE ROW LEVEL SECURITY;

-- Only admin can view audit logs
DROP POLICY IF EXISTS "Admin can view deleted users audit" ON public.deleted_users_audit;
CREATE POLICY "Admin can view deleted users audit" ON public.deleted_users_audit
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Grant permissions on audit table
GRANT SELECT, INSERT ON public.deleted_users_audit TO authenticated;

-- 2. Create the main delete function with audit logging
CREATE OR REPLACE FUNCTION admin_delete_user_with_audit(
    target_user_id UUID,
    admin_user_id UUID DEFAULT auth.uid(),
    deletion_reason TEXT DEFAULT 'Admin deletion'
)
RETURNS BOOLEAN AS $$
DECLARE
    target_user_record RECORD;
BEGIN
    -- Check if admin user has admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = COALESCE(admin_user_id, auth.uid()) AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only admin users can delete users';
    END IF;

    -- Get target user data for audit
    SELECT * INTO target_user_record
    FROM public.users 
    WHERE id = target_user_id;

    -- Check if user was found
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user not found';
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
        COALESCE(admin_user_id, auth.uid()),
        deletion_reason,
        row_to_json(target_user_record)::jsonb
    );

    -- Delete related data first (cascade delete)
    DELETE FROM public.pending_nelayan WHERE user_id = target_user_id;
    
    -- Update products to preserve order history
    UPDATE public.products 
    SET nelayan_id = NULL, status = 'inactive', updated_at = NOW()
    WHERE nelayan_id = target_user_id;
    
    -- Update transactions to preserve history
    UPDATE public.transactions 
    SET admin_notes = COALESCE(admin_notes || ' | ', '') || 'Nelayan account deleted on ' || NOW()::date
    WHERE nelayan_id = target_user_id;

    -- Delete the user from public.users
    DELETE FROM public.users WHERE id = target_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add DELETE policy for users table (admin only)
DROP POLICY IF EXISTS "Admin can delete users" ON public.users;
CREATE POLICY "Admin can delete users" ON public.users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 4. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION admin_delete_user_with_audit(UUID, UUID, TEXT) TO authenticated;

-- 5. Ensure admin user exists (update existing user to admin)
UPDATE public.users 
SET role = 'admin', updated_at = NOW()
WHERE email = 'admin@nelayan.com';

-- If admin user doesn't exist, create one (optional)
-- INSERT INTO public.users (email, role, full_name, created_at, updated_at)
-- VALUES ('admin@nelayan.com', 'admin', 'System Admin', NOW(), NOW())
-- ON CONFLICT (email) DO UPDATE SET role = 'admin', updated_at = NOW();

-- 6. Test the function (optional - uncomment to test)
-- SELECT admin_delete_user_with_audit('test-uuid'::uuid, auth.uid(), 'Test deletion');

-- =====================================================
-- DEPLOYMENT COMPLETE
-- =====================================================
-- Fungsi admin_delete_user_with_audit() sekarang tersedia
-- untuk dipanggil dari aplikasi frontend
-- =====================================================