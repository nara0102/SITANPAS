-- Fix approval system: create missing functions and update frontend compatibility

-- Create function to update user approval status
CREATE OR REPLACE FUNCTION update_user_approval_status(
  target_user_id UUID,
  new_status TEXT,
  reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update pending_nelayan status
  UPDATE pending_nelayan 
  SET 
    status = new_status::pending_status,
    admin_notes = COALESCE(reason, admin_notes),
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = target_user_id;
  
  -- If approved, update user role to nelayan
  IF new_status = 'approved' THEN
    UPDATE users 
    SET 
      role = 'nelayan',
      status = 'active',
      updated_at = NOW()
    WHERE id = target_user_id;
  END IF;
  
  -- If rejected, keep user as customer_guest
  IF new_status = 'rejected' THEN
    UPDATE users 
    SET 
      status = 'inactive',
      updated_at = NOW()
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- Create view to make frontend compatible (profiles view from users + pending_nelayan)
CREATE OR REPLACE VIEW profiles AS
SELECT 
  u.id,
  u.id as user_id,
  COALESCE(u.full_name, u.nama_lengkap, pn.nama) as full_name,
  u.email,
  COALESCE(u.phone, pn.nomor_telpon) as phone,
  COALESCE(u.address, pn.alamat) as location,
  NULL as bio,
  NULL as avatar_url,
  CASE 
    WHEN u.role = 'nelayan' THEN 'approved'
    WHEN pn.status IS NOT NULL THEN pn.status::text
    ELSE 'pending'
  END as approval_status,
  pn.reviewed_at as approved_at,
  pn.reviewed_by as approved_by,
  pn.admin_notes as rejection_reason,
  COALESCE(pn.created_at, u.created_at) as created_at,
  GREATEST(COALESCE(pn.updated_at, u.updated_at), u.updated_at) as updated_at,
  CASE 
    WHEN u.role = 'nelayan' OR pn.user_id IS NOT NULL THEN 'fisherman'
    ELSE 'customer'
  END as user_type
FROM users u
LEFT JOIN pending_nelayan pn ON u.id = pn.user_id
WHERE u.role IN ('nelayan', 'customer_guest') OR pn.user_id IS NOT NULL;

-- Grant permissions for the function and view
GRANT EXECUTE ON FUNCTION update_user_approval_status TO authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

-- Create trigger to automatically create transaction when order is created
CREATE OR REPLACE FUNCTION create_transaction_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  product_nelayan_id UUID;
BEGIN
  -- Get nelayan_id from product
  SELECT nelayan_id INTO product_nelayan_id
  FROM products 
  WHERE id = NEW.produk_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    order_id,
    nelayan_id,
    total_harga,
    metode_pembayaran,
    status
  ) VALUES (
    NEW.id,
    product_nelayan_id,
    NEW.total_harga,
    'cod', -- default payment method
    'pending'
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic transaction creation
DROP TRIGGER IF EXISTS trigger_create_transaction_from_order ON orders;
CREATE TRIGGER trigger_create_transaction_from_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_transaction_from_order();

-- Create function to reduce stock when order is created
CREATE OR REPLACE FUNCTION reduce_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reduce stock
  UPDATE products 
  SET 
    stok = stok - NEW.jumlah,
    updated_at = NOW()
  WHERE id = NEW.produk_id;
  
  -- Check if stock is now 0 or less, set status to inactive
  UPDATE products 
  SET 
    status = 'inactive',
    updated_at = NOW()
  WHERE id = NEW.produk_id AND stok <= 0;
  
  RETURN NEW;
END;
$$;

-- Create trigger for stock reduction
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_order ON orders;
CREATE TRIGGER trigger_reduce_stock_on_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION reduce_product_stock();

-- Create function to restore stock when order is cancelled
CREATE OR REPLACE FUNCTION restore_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only restore stock if order status changed to cancelled
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    UPDATE products 
    SET 
      stok = stok + NEW.jumlah,
      status = 'active', -- reactivate product
      updated_at = NOW()
    WHERE id = NEW.produk_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for stock restoration
DROP TRIGGER IF EXISTS trigger_restore_stock_on_cancel ON orders;
CREATE TRIGGER trigger_restore_stock_on_cancel
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION restore_product_stock();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_transaction_from_order TO authenticated;
GRANT EXECUTE ON FUNCTION reduce_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION restore_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION create_transaction_from_order TO anon;
GRANT EXECUTE ON FUNCTION reduce_product_stock TO anon;
GRANT EXECUTE ON FUNCTION restore_product_stock TO anon;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';