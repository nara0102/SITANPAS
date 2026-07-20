-- =====================================================
-- FUNCTIONS AND TRIGGERS AFTER TABLES ARE CREATED
-- =====================================================

-- =====================================================
-- NELAYAN APPROVAL FUNCTIONS
-- =====================================================

-- Function to approve nelayan application
CREATE OR REPLACE FUNCTION approve_nelayan_application(
    application_id UUID,
    admin_user_id UUID,
    notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    target_user_id UUID;
    application_exists BOOLEAN;
BEGIN
    -- Check if admin user has admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = admin_user_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only admin users can approve applications';
    END IF;

    -- Get the user_id from pending application
    SELECT user_id, TRUE INTO target_user_id, application_exists
    FROM public.pending_nelayan 
    WHERE id = application_id AND status = 'pending';

    IF NOT application_exists THEN
        RAISE EXCEPTION 'Application not found or already processed';
    END IF;

    -- Update pending application status
    UPDATE public.pending_nelayan 
    SET 
        status = 'approved',
        admin_notes = notes,
        reviewed_by = admin_user_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = application_id;

    -- Update user role to nelayan
    UPDATE public.users 
    SET 
        role = 'nelayan',
        status = 'active',
        updated_at = NOW()
    WHERE id = target_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject nelayan application
CREATE OR REPLACE FUNCTION reject_nelayan_application(
    application_id UUID,
    admin_user_id UUID,
    notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if admin user has admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = admin_user_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only admin users can reject applications';
    END IF;

    -- Update pending application status
    UPDATE public.pending_nelayan 
    SET 
        status = 'rejected',
        admin_notes = notes,
        reviewed_by = admin_user_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = application_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found or already processed';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STOCK MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to reduce product stock when order is created
CREATE OR REPLACE FUNCTION reduce_product_stock()
RETURNS TRIGGER AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    -- Get current stock
    SELECT stok INTO current_stock
    FROM public.products
    WHERE id = NEW.produk_id;

    -- Check if enough stock available
    IF current_stock < NEW.jumlah THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', current_stock, NEW.jumlah;
    END IF;

    -- Reduce stock
    UPDATE public.products
    SET 
        stok = stok - NEW.jumlah,
        updated_at = NOW()
    WHERE id = NEW.produk_id;

    -- Check if stock is now zero and deactivate product
    UPDATE public.products
    SET 
        status = 'inactive',
        updated_at = NOW()
    WHERE id = NEW.produk_id AND stok = 0;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to restore product stock when order is cancelled
CREATE OR REPLACE FUNCTION restore_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Only restore stock if order status changed to cancelled
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
        -- Restore stock
        UPDATE public.products
        SET 
            stok = stok + OLD.jumlah,
            status = 'active', -- Reactivate product
            updated_at = NOW()
        WHERE id = OLD.produk_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRANSACTION MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to create transaction when order is created
CREATE OR REPLACE FUNCTION create_transaction_for_order()
RETURNS TRIGGER AS $$
DECLARE
    product_nelayan_id UUID;
BEGIN
    -- Get nelayan_id from product
    SELECT nelayan_id INTO product_nelayan_id
    FROM public.products
    WHERE id = NEW.produk_id;

    -- Create transaction record
    INSERT INTO public.transactions (
        order_id,
        nelayan_id,
        total_harga,
        metode_pembayaran,
        status
    ) VALUES (
        NEW.id,
        product_nelayan_id,
        NEW.total_harga,
        'cod', -- Default to cash on delivery
        'pending'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- USER PROFILE MANAGEMENT
-- =====================================================

-- Function to create user profile when auth user is created
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, role, status)
    VALUES (
        NEW.id,
        NEW.email,
        'customer_guest',
        'active'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger for updated_at columns
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_nelayan_updated_at
    BEFORE UPDATE ON public.pending_nelayan
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to create user profile when auth user is created
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- Trigger to reduce stock when order is created
CREATE TRIGGER reduce_stock_on_order
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION reduce_product_stock();

-- Trigger to restore stock when order is cancelled
CREATE TRIGGER restore_stock_on_cancel
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION restore_product_stock();

-- Trigger to create transaction when order is created
CREATE TRIGGER create_transaction_on_order
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION create_transaction_for_order();

-- =====================================================
-- HELPER FUNCTIONS FOR BUSINESS LOGIC
-- =====================================================

-- Function to get nelayan statistics
CREATE OR REPLACE FUNCTION get_nelayan_stats(nelayan_user_id UUID)
RETURNS TABLE (
    total_products BIGINT,
    active_products BIGINT,
    total_orders BIGINT,
    total_revenue DECIMAL(12,2),
    pending_orders BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.products WHERE nelayan_id = nelayan_user_id) as total_products,
        (SELECT COUNT(*) FROM public.products WHERE nelayan_id = nelayan_user_id AND status = 'active') as active_products,
        (SELECT COUNT(*) FROM public.transactions WHERE nelayan_id = nelayan_user_id) as total_orders,
        (SELECT COALESCE(SUM(total_harga), 0) FROM public.transactions WHERE nelayan_id = nelayan_user_id AND status = 'success') as total_revenue,
        (SELECT COUNT(*) FROM public.transactions WHERE nelayan_id = nelayan_user_id AND status = 'pending') as pending_orders;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access nelayan data
CREATE OR REPLACE FUNCTION can_access_nelayan_data(user_id UUID, target_nelayan_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role user_role;
BEGIN
    SELECT role INTO user_role FROM public.users WHERE id = user_id;
    
    -- Admin can access all data
    IF user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Nelayan can only access their own data
    IF user_role = 'nelayan' AND user_id = target_nelayan_id THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;