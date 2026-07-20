-- =====================================================
-- ADMIN VIEWS AND REPORTS
-- =====================================================

-- =====================================================
-- NELAYAN PERFORMANCE VIEWS
-- =====================================================

-- View: Nelayan performance summary
CREATE OR REPLACE VIEW admin_nelayan_performance AS
SELECT 
    u.id as nelayan_id,
    u.full_name as nelayan_name,
    u.email,
    u.phone,
    u.created_at as joined_date,
    
    -- Product statistics
    COALESCE(p.total_products, 0) as total_products,
    COALESCE(p.active_products, 0) as active_products,
    COALESCE(p.inactive_products, 0) as inactive_products,
    
    -- Transaction statistics
    COALESCE(t.total_transactions, 0) as total_transactions,
    COALESCE(t.successful_transactions, 0) as successful_transactions,
    COALESCE(t.pending_transactions, 0) as pending_transactions,
    COALESCE(t.total_revenue, 0) as total_revenue,
    
    -- Order statistics
    COALESCE(o.total_orders, 0) as total_orders,
    COALESCE(o.completed_orders, 0) as completed_orders,
    COALESCE(o.pending_orders, 0) as pending_orders,
    COALESCE(o.cancelled_orders, 0) as cancelled_orders,
    
    -- Performance metrics
    CASE 
        WHEN COALESCE(t.total_transactions, 0) > 0 
        THEN ROUND((COALESCE(t.successful_transactions, 0)::DECIMAL / t.total_transactions) * 100, 2)
        ELSE 0 
    END as success_rate_percentage,
    
    CASE 
        WHEN COALESCE(o.total_orders, 0) > 0 
        THEN ROUND(COALESCE(t.total_revenue, 0) / o.total_orders, 2)
        ELSE 0 
    END as average_order_value

FROM public.users u
LEFT JOIN (
    -- Product statistics subquery
    SELECT 
        nelayan_id,
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE status = 'active') as active_products,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive_products
    FROM public.products
    GROUP BY nelayan_id
) p ON u.id = p.nelayan_id

LEFT JOIN (
    -- Transaction statistics subquery
    SELECT 
        nelayan_id,
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE status = 'success') as successful_transactions,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_transactions,
        COALESCE(SUM(total_harga) FILTER (WHERE status = 'success'), 0) as total_revenue
    FROM public.transactions
    GROUP BY nelayan_id
) t ON u.id = t.nelayan_id

LEFT JOIN (
    -- Order statistics subquery
    SELECT 
        p.nelayan_id,
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE o.status = 'completed') as completed_orders,
        COUNT(*) FILTER (WHERE o.status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE o.status = 'cancelled') as cancelled_orders
    FROM public.orders o
    JOIN public.products p ON o.produk_id = p.id
    GROUP BY p.nelayan_id
) o ON u.id = o.nelayan_id

WHERE u.role = 'nelayan'
ORDER BY t.total_revenue DESC NULLS LAST;

-- =====================================================
-- PRODUCT ANALYTICS VIEWS
-- =====================================================

-- View: Product performance analytics
CREATE OR REPLACE VIEW admin_product_analytics AS
SELECT 
    p.id as product_id,
    p.nama_produk,
    p.kategori,
    p.harga,
    p.stok,
    p.status,
    p.created_at,
    
    -- Nelayan information
    u.full_name as nelayan_name,
    u.email as nelayan_email,
    
    -- Sales statistics
    COALESCE(o.total_orders, 0) as total_orders,
    COALESCE(o.total_quantity_sold, 0) as total_quantity_sold,
    COALESCE(o.total_revenue, 0) as total_revenue,
    
    -- Performance metrics
    CASE 
        WHEN p.created_at > NOW() - INTERVAL '30 days' 
        THEN COALESCE(o.total_orders, 0) 
        ELSE 0 
    END as orders_last_30_days,
    
    CASE 
        WHEN COALESCE(o.total_orders, 0) > 0 
        THEN ROUND(COALESCE(o.total_revenue, 0) / o.total_orders, 2)
        ELSE 0 
    END as average_order_value,
    
    -- Stock status
    CASE 
        WHEN p.stok = 0 THEN 'Out of Stock'
        WHEN p.stok <= 5 THEN 'Low Stock'
        WHEN p.stok <= 20 THEN 'Medium Stock'
        ELSE 'High Stock'
    END as stock_status

FROM public.products p
JOIN public.users u ON p.nelayan_id = u.id
LEFT JOIN (
    -- Order statistics for each product
    SELECT 
        produk_id,
        COUNT(*) as total_orders,
        SUM(jumlah) as total_quantity_sold,
        SUM(total_harga) as total_revenue
    FROM public.orders
    WHERE status NOT IN ('cancelled')
    GROUP BY produk_id
) o ON p.id = o.produk_id

ORDER BY o.total_revenue DESC NULLS LAST;

-- =====================================================
-- TRANSACTION MONITORING VIEWS
-- =====================================================

-- View: Daily transaction summary
CREATE OR REPLACE VIEW admin_daily_transactions AS
SELECT 
    DATE(t.created_at) as transaction_date,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE t.status = 'success') as successful_transactions,
    COUNT(*) FILTER (WHERE t.status = 'pending') as pending_transactions,
    COUNT(*) FILTER (WHERE t.status = 'failed') as failed_transactions,
    SUM(t.total_harga) as total_amount,
    SUM(t.total_harga) FILTER (WHERE t.status = 'success') as successful_amount,
    
    -- Payment method breakdown
    COUNT(*) FILTER (WHERE t.metode_pembayaran = 'cod') as cod_transactions,
    COUNT(*) FILTER (WHERE t.metode_pembayaran = 'transfer') as transfer_transactions,
    COUNT(*) FILTER (WHERE t.metode_pembayaran = 'ewallet') as ewallet_transactions,
    
    -- Average transaction value
    ROUND(AVG(t.total_harga), 2) as average_transaction_value

FROM public.transactions t
WHERE t.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(t.created_at)
ORDER BY transaction_date DESC;

-- =====================================================
-- CUSTOMER ANALYTICS VIEWS
-- =====================================================

-- View: Customer order patterns
CREATE OR REPLACE VIEW admin_customer_analytics AS
SELECT 
    o.customer_nama,
    o.customer_telpon,
    o.customer_alamat,
    COUNT(*) as total_orders,
    SUM(o.total_harga) as total_spent,
    AVG(o.total_harga) as average_order_value,
    MIN(o.created_at) as first_order_date,
    MAX(o.created_at) as last_order_date,
    
    -- Order status breakdown
    COUNT(*) FILTER (WHERE o.status = 'completed') as completed_orders,
    COUNT(*) FILTER (WHERE o.status = 'pending') as pending_orders,
    COUNT(*) FILTER (WHERE o.status = 'cancelled') as cancelled_orders,
    
    -- Customer classification
    CASE 
        WHEN COUNT(*) >= 10 THEN 'VIP Customer'
        WHEN COUNT(*) >= 5 THEN 'Regular Customer'
        WHEN COUNT(*) >= 2 THEN 'Repeat Customer'
        ELSE 'New Customer'
    END as customer_type

FROM public.orders o
GROUP BY o.customer_nama, o.customer_telpon, o.customer_alamat
ORDER BY total_spent DESC;

-- =====================================================
-- PENDING APPLICATIONS VIEW
-- =====================================================

-- View: Pending nelayan applications with details
CREATE OR REPLACE VIEW admin_pending_applications AS
SELECT 
    pn.id as application_id,
    pn.nama,
    pn.alamat,
    pn.nomor_telpon,
    pn.status,
    pn.created_at as application_date,
    pn.admin_notes,
    
    -- User information
    u.email,
    u.created_at as user_registered_date,
    
    -- Reviewer information (if any)
    reviewer.full_name as reviewed_by_name,
    pn.reviewed_at,
    
    -- Time since application
    EXTRACT(DAYS FROM NOW() - pn.created_at) as days_pending

FROM public.pending_nelayan pn
JOIN public.users u ON pn.user_id = u.id
LEFT JOIN public.users reviewer ON pn.reviewed_by = reviewer.id
ORDER BY pn.created_at ASC;

-- =====================================================
-- SYSTEM HEALTH MONITORING
-- =====================================================

-- View: System overview dashboard
CREATE OR REPLACE VIEW admin_system_overview AS
SELECT 
    -- User statistics
    (SELECT COUNT(*) FROM public.users WHERE role = 'admin') as total_admins,
    (SELECT COUNT(*) FROM public.users WHERE role = 'nelayan') as total_nelayan,
    (SELECT COUNT(*) FROM public.users WHERE role = 'customer_guest') as total_customers,
    
    -- Product statistics
    (SELECT COUNT(*) FROM public.products) as total_products,
    (SELECT COUNT(*) FROM public.products WHERE status = 'active') as active_products,
    (SELECT COUNT(*) FROM public.products WHERE stok = 0) as out_of_stock_products,
    
    -- Order statistics
    (SELECT COUNT(*) FROM public.orders) as total_orders,
    (SELECT COUNT(*) FROM public.orders WHERE status = 'pending') as pending_orders,
    (SELECT COUNT(*) FROM public.orders WHERE created_at >= CURRENT_DATE) as orders_today,
    
    -- Transaction statistics
    (SELECT COUNT(*) FROM public.transactions) as total_transactions,
    (SELECT COALESCE(SUM(total_harga), 0) FROM public.transactions WHERE status = 'success') as total_revenue,
    (SELECT COUNT(*) FROM public.transactions WHERE status = 'pending') as pending_transactions,
    
    -- Application statistics
    (SELECT COUNT(*) FROM public.pending_nelayan WHERE status = 'pending') as pending_applications,
    
    -- Recent activity
    (SELECT COUNT(*) FROM public.orders WHERE created_at >= NOW() - INTERVAL '24 hours') as orders_last_24h,
    (SELECT COUNT(*) FROM public.products WHERE created_at >= NOW() - INTERVAL '7 days') as new_products_last_week;

-- =====================================================
-- REVENUE ANALYTICS
-- =====================================================

-- View: Monthly revenue report
CREATE OR REPLACE VIEW admin_monthly_revenue AS
SELECT 
    DATE_TRUNC('month', t.created_at) as month,
    COUNT(*) as total_transactions,
    SUM(t.total_harga) as total_revenue,
    AVG(t.total_harga) as average_transaction_value,
    
    -- Nelayan count for the month
    COUNT(DISTINCT t.nelayan_id) as active_nelayan_count,
    
    -- Payment method breakdown
    SUM(t.total_harga) FILTER (WHERE t.metode_pembayaran = 'cod') as cod_revenue,
    SUM(t.total_harga) FILTER (WHERE t.metode_pembayaran = 'transfer') as transfer_revenue,
    SUM(t.total_harga) FILTER (WHERE t.metode_pembayaran = 'ewallet') as ewallet_revenue

FROM public.transactions t
WHERE t.status = 'success'
AND t.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
GROUP BY DATE_TRUNC('month', t.created_at)
ORDER BY month DESC;

-- =====================================================
-- GRANT PERMISSIONS FOR VIEWS
-- =====================================================

-- Grant select permissions on views to authenticated users
GRANT SELECT ON admin_nelayan_performance TO authenticated;
GRANT SELECT ON admin_product_analytics TO authenticated;
GRANT SELECT ON admin_daily_transactions TO authenticated;
GRANT SELECT ON admin_customer_analytics TO authenticated;
GRANT SELECT ON admin_pending_applications TO authenticated;
GRANT SELECT ON admin_system_overview TO authenticated;
GRANT SELECT ON admin_monthly_revenue TO authenticated;

-- Additional RLS policies for views (admin only access)
ALTER VIEW admin_nelayan_performance SET (security_barrier = true);
ALTER VIEW admin_product_analytics SET (security_barrier = true);
ALTER VIEW admin_daily_transactions SET (security_barrier = true);
ALTER VIEW admin_customer_analytics SET (security_barrier = true);
ALTER VIEW admin_pending_applications SET (security_barrier = true);
ALTER VIEW admin_system_overview SET (security_barrier = true);
ALTER VIEW admin_monthly_revenue SET (security_barrier = true);