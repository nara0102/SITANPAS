-- =====================================================
-- FIX FUNCTION PARAMETER ORDER
-- Jalankan script ini di Supabase Dashboard > SQL Editor
-- =====================================================

-- Drop existing function first
DROP FUNCTION IF EXISTS admin_delete_user_with_audit(UUID, UUID, TEXT);

-- Create function with correct parameter order that matches frontend call
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_delete_user_with_audit(UUID, UUID, TEXT) TO authenticated;

-- Update admin user role (make sure admin@nelayan.com is admin)
UPDATE public.users 
SET role = 'admin', updated_at = NOW()
WHERE email = 'admin@nelayan.com';

-- Verify the function signature
SELECT 
    routine_name,
    routine_type,
    data_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'admin_delete_user_with_audit';

-- =====================================================
-- FUNCTION FIXED - Ready for testing
-- =====================================================