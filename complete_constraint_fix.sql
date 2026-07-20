-- =====================================================
-- COMPLETE CONSTRAINT FIX FOR USER DELETION
-- Jalankan script ini di Supabase Dashboard > SQL Editor
-- =====================================================

-- PART 1: FIX PRODUCTS TABLE CONSTRAINT
-- =====================================================

-- Step 1: Drop the existing foreign key constraint for products
ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS products_nelayan_id_fkey;

-- Step 2: Modify the nelayan_id column to allow NULL values in products
ALTER TABLE public.products 
ALTER COLUMN nelayan_id DROP NOT NULL;

-- Step 3: Add back the foreign key constraint with SET NULL for products
ALTER TABLE public.products 
ADD CONSTRAINT products_nelayan_id_fkey 
FOREIGN KEY (nelayan_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- PART 2: FIX TRANSACTIONS TABLE CONSTRAINT
-- =====================================================

-- Step 4: Drop the existing foreign key constraint for transactions
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS fk_transactions_nelayan;

-- Also check for other possible constraint names
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_nelayan_id_fkey;

-- Step 5: Allow NULL values in nelayan_id column for transactions
ALTER TABLE public.transactions 
ALTER COLUMN nelayan_id DROP NOT NULL;

-- Step 6: Add new foreign key constraint with ON DELETE SET NULL for transactions
ALTER TABLE public.transactions 
ADD CONSTRAINT fk_transactions_nelayan 
FOREIGN KEY (nelayan_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- PART 3: UPDATE ADMIN DELETE FUNCTION
-- =====================================================

-- Step 7: Drop existing function first, then recreate with new return type
DROP FUNCTION IF EXISTS admin_delete_user_with_audit(UUID, UUID, TEXT);

-- Create the admin_delete_user_with_audit function with JSON return type
CREATE OR REPLACE FUNCTION admin_delete_user_with_audit(
    target_user_id UUID,
    admin_user_id UUID DEFAULT auth.uid(),
    deletion_reason TEXT DEFAULT 'Admin deletion'
)
RETURNS JSON AS $$
DECLARE
    target_user_record RECORD;
    current_admin_id UUID;
    affected_products INTEGER := 0;
    affected_transactions INTEGER := 0;
    affected_pending INTEGER := 0;
    result JSON;
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

    -- Count affected records before deletion
    SELECT COUNT(*) INTO affected_products 
    FROM public.products WHERE nelayan_id = target_user_id;
    
    SELECT COUNT(*) INTO affected_transactions 
    FROM public.transactions WHERE nelayan_id = target_user_id;
    
    SELECT COUNT(*) INTO affected_pending 
    FROM public.pending_nelayan WHERE user_id = target_user_id;

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

    -- Delete related data first
    DELETE FROM public.pending_nelayan WHERE user_id = target_user_id;
    
    -- Update products to preserve order history (nelayan_id will be set to NULL automatically)
    UPDATE public.products 
    SET status = 'inactive', 
        updated_at = NOW(),
        deskripsi = COALESCE(deskripsi || ' | ', '') || 'Nelayan account deleted on ' || NOW()::date
    WHERE nelayan_id = target_user_id;
    
    -- Update transactions to preserve history (nelayan_id will be set to NULL automatically)
    UPDATE public.transactions 
    SET admin_notes = COALESCE(admin_notes || ' | ', '') || 'Nelayan account deleted on ' || NOW()::date
    WHERE nelayan_id = target_user_id;

    -- Delete the user from public.users (this will automatically set nelayan_id to NULL in both tables)
    DELETE FROM public.users WHERE id = target_user_id;
    
    -- Prepare result
    result := json_build_object(
        'success', true,
        'deleted_user_id', target_user_id,
        'deleted_user_email', target_user_record.email,
        'affected_products', affected_products,
        'affected_transactions', affected_transactions,
        'affected_pending', affected_pending,
        'deletion_timestamp', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_delete_user_with_audit(UUID, UUID, TEXT) TO authenticated;

-- PART 4: UPDATE RLS POLICIES
-- =====================================================

-- Step 8: Update RLS policies to handle NULL nelayan_id for products
DROP POLICY IF EXISTS "Nelayan can view own products" ON public.products;
DROP POLICY IF EXISTS "Nelayan can update own products" ON public.products;
DROP POLICY IF EXISTS "Admin can view products with deleted nelayan" ON public.products;

-- Recreate policies with NULL handling for products
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

-- Step 9: Update RLS policies for transactions
DROP POLICY IF EXISTS "Nelayan can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admin can view transactions with deleted nelayan" ON public.transactions;

-- Recreate policies with NULL handling for transactions
CREATE POLICY "Nelayan can view own transactions" ON public.transactions
    FOR SELECT
    USING (
        nelayan_id = auth.uid() AND
        nelayan_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'nelayan'
        )
    );

-- Add policy for viewing transactions with NULL nelayan_id (deleted users)
CREATE POLICY "Admin can view transactions with deleted nelayan" ON public.transactions
    FOR SELECT
    USING (
        nelayan_id IS NULL AND
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- PART 5: VERIFICATION
-- =====================================================

-- Step 10: Verify the changes
SELECT 
    'products' as table_name,
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'products' 
AND column_name = 'nelayan_id'

UNION ALL

SELECT 
    'transactions' as table_name,
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transactions' 
AND column_name = 'nelayan_id';

-- Check foreign key constraints
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND (tc.table_name = 'products' OR tc.table_name = 'transactions')
AND kcu.column_name = 'nelayan_id';

-- =====================================================
-- CONSTRAINT FIX COMPLETE - Ready for testing
-- =====================================================