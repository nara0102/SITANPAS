-- Create comprehensive transaction reports for nelayan (fishermen)

-- View: Detailed transaction report per nelayan
CREATE OR REPLACE VIEW admin_nelayan_transaction_report AS
SELECT 
    u.id as nelayan_id,
    u.nama_lengkap as nelayan_name,
    u.email as nelayan_email,
    u.phone as nelayan_phone,
    u.address as nelayan_location,
    
    -- Transaction statistics
    COUNT(DISTINCT t.id) as total_transactions,
    COUNT(DISTINCT o.id) as total_orders,
    
    -- Revenue statistics
    COALESCE(SUM(CASE WHEN t.status = 'success' THEN t.total_harga ELSE 0 END), 0) as total_revenue,
    COALESCE(SUM(CASE WHEN t.status = 'pending' THEN t.total_harga ELSE 0 END), 0) as pending_revenue,
    COALESCE(SUM(t.total_harga), 0) as gross_revenue,
    
    -- Order status breakdown
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
    COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN o.status = 'shipped' THEN 1 END) as shipped_orders,
     COUNT(CASE WHEN o.status = 'paid' THEN 1 END) as paid_orders,
      COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
     
     -- Product statistics
    COUNT(DISTINCT p.id) as total_products,
    COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_products,
    COALESCE(SUM(p.stok), 0) as total_stock_kg,
    
    -- Time-based statistics
    MIN(t.created_at) as first_transaction_date,
    MAX(t.created_at) as last_transaction_date,
    
    -- Performance metrics
    CASE 
        WHEN COUNT(DISTINCT t.id) > 0 THEN 
            ROUND(COALESCE(SUM(CASE WHEN t.status = 'success' THEN t.total_harga ELSE 0 END), 0) / COUNT(DISTINCT t.id), 2)
        ELSE 0 
    END as avg_transaction_value,
    
    CASE 
        WHEN COUNT(DISTINCT o.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN o.status = 'completed' THEN 1 END)::DECIMAL / COUNT(DISTINCT o.id)) * 100, 2)
        ELSE 0 
    END as delivery_success_rate,
    
    -- Recent activity
    CASE 
        WHEN MAX(t.created_at) >= NOW() - INTERVAL '7 days' THEN 'Active'
        WHEN MAX(t.created_at) >= NOW() - INTERVAL '30 days' THEN 'Moderate'
        ELSE 'Inactive'
    END as activity_status,
    
    u.created_at as nelayan_join_date
    
FROM users u
LEFT JOIN products p ON u.id = p.nelayan_id
LEFT JOIN orders o ON p.id = o.produk_id
LEFT JOIN transactions t ON o.id = t.order_id
WHERE u.role = 'nelayan'
GROUP BY u.id, u.nama_lengkap, u.email, u.phone, u.address, u.created_at
ORDER BY total_revenue DESC, total_transactions DESC;

-- View: Monthly transaction summary per nelayan
CREATE OR REPLACE VIEW admin_nelayan_monthly_report AS
SELECT 
    u.id as nelayan_id,
    u.nama_lengkap as nelayan_name,
    DATE_TRUNC('month', t.created_at) as transaction_month,
    
    COUNT(DISTINCT t.id) as monthly_transactions,
    COUNT(DISTINCT o.id) as monthly_orders,
    COALESCE(SUM(CASE WHEN t.status = 'success' THEN t.total_harga ELSE 0 END), 0) as monthly_revenue,
    COALESCE(SUM(t.total_harga), 0) as monthly_gross_revenue,
    
    -- Product sold statistics
    COALESCE(SUM(o.jumlah), 0) as total_kg_sold,
    
    -- Average metrics
    CASE 
        WHEN COUNT(DISTINCT t.id) > 0 THEN 
            ROUND(COALESCE(SUM(CASE WHEN t.status = 'success' THEN t.total_harga ELSE 0 END), 0) / COUNT(DISTINCT t.id), 2)
        ELSE 0 
    END as avg_monthly_transaction_value
    
FROM users u
JOIN products p ON u.id = p.nelayan_id
JOIN orders o ON p.id = o.produk_id
JOIN transactions t ON o.id = t.order_id
WHERE u.role = 'nelayan'
  AND t.created_at >= DATE_TRUNC('month', NOW() - INTERVAL '12 months')
GROUP BY u.id, u.nama_lengkap, DATE_TRUNC('month', t.created_at)
ORDER BY u.nama_lengkap, transaction_month DESC;

-- View: Top performing products per nelayan
CREATE OR REPLACE VIEW admin_nelayan_top_products AS
SELECT 
    u.id as nelayan_id,
    u.nama_lengkap as nelayan_name,
    p.id as product_id,
    p.nama_produk as product_name,
    p.harga as product_price,
    p.stok as current_stock,
    
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.jumlah), 0) as total_kg_sold,
    COALESCE(SUM(o.total_harga), 0) as total_product_revenue,
    
    ROUND(AVG(o.jumlah), 2) as avg_order_size_kg,
    
    -- Ranking within nelayan's products
    ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY COALESCE(SUM(o.total_harga), 0) DESC) as revenue_rank,
    
    p.created_at as product_created_date,
    MAX(o.created_at) as last_order_date
    
FROM users u
JOIN products p ON u.id = p.nelayan_id
LEFT JOIN orders o ON p.id = o.produk_id AND o.status != 'cancelled'
WHERE u.role = 'nelayan'
GROUP BY u.id, u.nama_lengkap, p.id, p.nama_produk, p.harga, p.stok, p.created_at
ORDER BY u.nama_lengkap, total_product_revenue DESC;

-- View: System-wide transaction summary for admin dashboard
CREATE OR REPLACE VIEW admin_system_summary AS
SELECT 
    -- Overall statistics
    COUNT(DISTINCT u.id) as total_nelayan,
    COUNT(DISTINCT p.id) as total_products,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT t.id) as total_transactions,
    
    -- Revenue statistics
    COALESCE(SUM(CASE WHEN t.status = 'success' THEN t.total_harga ELSE 0 END), 0) as total_system_revenue,
    COALESCE(SUM(CASE WHEN t.status = 'pending' THEN t.total_harga ELSE 0 END), 0) as pending_system_revenue,
    
    -- Today's statistics
    COUNT(DISTINCT CASE WHEN DATE(o.created_at) = CURRENT_DATE THEN o.id END) as today_orders,
    COALESCE(SUM(CASE WHEN DATE(t.created_at) = CURRENT_DATE AND t.status = 'success' THEN t.total_harga ELSE 0 END), 0) as today_revenue,
    
    -- This month's statistics
    COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN o.id END) as this_month_orders,
    COALESCE(SUM(CASE WHEN DATE_TRUNC('month', t.created_at) = DATE_TRUNC('month', CURRENT_DATE) AND t.status = 'success' THEN t.total_harga ELSE 0 END), 0) as this_month_revenue,
    
    -- Active statistics
    COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_products,
    COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) as active_nelayan,
    
    -- Stock statistics
    COALESCE(SUM(CASE WHEN p.status = 'active' THEN p.stok ELSE 0 END), 0) as total_available_stock_kg
    
FROM users u
LEFT JOIN products p ON u.id = p.nelayan_id
LEFT JOIN orders o ON p.id = o.produk_id
LEFT JOIN transactions t ON o.id = t.order_id
WHERE u.role = 'nelayan';

-- Grant permissions to authenticated users (admin)
GRANT SELECT ON admin_nelayan_transaction_report TO authenticated;
GRANT SELECT ON admin_nelayan_monthly_report TO authenticated;
GRANT SELECT ON admin_nelayan_top_products TO authenticated;
GRANT SELECT ON admin_system_summary TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';