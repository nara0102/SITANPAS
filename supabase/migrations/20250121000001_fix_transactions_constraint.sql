-- =====================================================
-- FIX TRANSACTIONS TABLE CONSTRAINT FOR USER DELETION
-- =====================================================

-- Problem: transactions.nelayan_id has ON DELETE RESTRICT which prevents user deletion
-- Solution: Change to ON DELETE SET NULL and allow NULL values

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS fk_transactions_nelayan;

-- Step 2: Allow NULL values in nelayan_id column
ALTER TABLE public.transactions 
ALTER COLUMN nelayan_id DROP NOT NULL;

-- Step 3: Add new foreign key constraint with ON DELETE SET NULL
ALTER TABLE public.transactions 
ADD CONSTRAINT fk_transactions_nelayan 
FOREIGN KEY (nelayan_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 4: Update admin_delete_user_with_audit function to handle transactions properly

-- TAMBAHKAN BARIS INI UNTUK MENGHAPUS FUNGSI LAMA TERLEBIH DAHULU:
DROP FUNCTION IF EXISTS admin_delete_user_with_audit(UUID, UUID, TEXT);

-- KEMUDIAN BUAT ULANG FUNGSINYA:
CREATE OR REPLACE FUNCTION admin_delete_user_with_audit(
    target_user_id UUID,
    admin_user_id UUID,
    deletion_reason TEXT DEFAULT 'Admin deletion'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_record RECORD;
    current_admin_id UUID;
    affected_products INTEGER := 0;
    affected_orders INTEGER := 0;
    affected_transactions INTEGER := 0;
    affected_pending INTEGER := 0;
    result JSON;
BEGIN
    -- Validate admin permissions
    SELECT id INTO current_admin_id 
    FROM public.users 
    WHERE id = admin_user_id AND role = 'admin';
    
    IF current_admin_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Only admin users can delete users';
    END IF;
    
    -- Get target user info
    SELECT * INTO target_user_record 
    FROM public.users 
    WHERE id = target_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found with ID: %', target_user_id;
    END IF;
    
    -- Count affected records for audit
    SELECT COUNT(*) INTO affected_products 
    FROM public.products 
    WHERE nelayan_id = target_user_id;
    
    SELECT COUNT(*) INTO affected_orders 
    FROM public.orders o 
    JOIN public.products p ON o.produk_id = p.id 
    WHERE p.nelayan_id = target_user_id;
    
    SELECT COUNT(*) INTO affected_transactions 
    FROM public.transactions 
    WHERE nelayan_id = target_user_id;
    
    SELECT COUNT(*) INTO affected_pending 
    FROM public.pending_nelayan 
    WHERE user_id = target_user_id;
    
    -- Create audit record BEFORE deletion
    INSERT INTO public.user_deletion_audit (
        deleted_user_id,
        deleted_user_email,
        deleted_user_role,
        deleted_user_name,
        admin_id,
        admin_email,
        deletion_reason,
        affected_products_count,
        affected_orders_count,
        affected_transactions_count,
        affected_pending_count,
        user_data_backup
    ) VALUES (
        target_user_record.id,
        target_user_record.email,
        target_user_record.role::TEXT,
        target_user_record.full_name,
        current_admin_id,
        (SELECT email FROM public.users WHERE id = current_admin_id),
        deletion_reason,
        affected_products,
        affected_orders,
        affected_transactions,
        affected_pending,
        row_to_json(target_user_record)
    );
    
    -- Handle related data before user deletion
    -- 1. Set nelayan_id to NULL in products (will cascade to orders via trigger)
    UPDATE public.products 
    SET nelayan_id = NULL, 
        status = 'inactive',
        updated_at = NOW()
    WHERE nelayan_id = target_user_id;
    
    -- 2. Transactions nelayan_id will be set to NULL automatically by FK constraint
    -- No manual update needed due to ON DELETE SET NULL
    
    -- 3. Delete pending nelayan applications (will cascade)
    DELETE FROM public.pending_nelayan 
    WHERE user_id = target_user_id;
    
    -- 4. Finally delete the user (this will trigger auth.users deletion via CASCADE)
    DELETE FROM public.users 
    WHERE id = target_user_id;
    
    -- Prepare success response
    result := json_build_object(
        'success', true,
        'message', 'User deleted successfully',
        'deleted_user', json_build_object(
            'id', target_user_record.id,
            'email', target_user_record.email,
            'role', target_user_record.role,
            'name', target_user_record.full_name
        ),
        'admin_info', json_build_object(
            'admin_id', current_admin_id,
            'admin_email', (SELECT email FROM public.users WHERE id = current_admin_id)
        ),
        'affected_records', json_build_object(
            'products', affected_products,
            'orders', affected_orders,
            'transactions', affected_transactions,
            'pending_applications', affected_pending
        ),
        'deletion_reason', deletion_reason,
        'deleted_at', NOW()
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE EXCEPTION 'Failed to delete user: %', SQLERRM;
END;
$$;

-- Step 5: Update RLS policies for transactions to handle NULL nelayan_id
DROP POLICY IF EXISTS "Nelayan can view own transactions" ON public.transactions;

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

-- Step 6: Update admin views to handle NULL nelayan_id in transactions
CREATE OR REPLACE VIEW admin_transaction_summary AS
SELECT 
    t.id,
    t.order_id,
    COALESCE(u.full_name, 'Deleted User') as nelayan_name,
    COALESCE(u.email, 'N/A') as nelayan_email,
    t.total_harga,
    t.metode_pembayaran,
    t.status,
    t.created_at,
    t.updated_at,
    CASE 
        WHEN t.nelayan_id IS NULL THEN 'User Deleted'
        ELSE 'Active'
    END as nelayan_status
FROM public.transactions t
LEFT JOIN public.users u ON t.nelayan_id = u.id
ORDER BY t.created_at DESC;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_delete_user_with_audit TO authenticated;
GRANT SELECT ON admin_transaction_summary TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check constraint changes
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'transactions' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'nelayan_id';

-- Check if nelayan_id allows NULL
SELECT 
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'transactions' 
    AND column_name = 'nelayan_id';