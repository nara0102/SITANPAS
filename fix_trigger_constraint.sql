-- Fix trigger constraint issue by adding ON CONFLICT handling

-- Update the trigger function to handle duplicate key constraint
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
  
  -- Create transaction record with ON CONFLICT handling
  INSERT INTO transactions (
    order_id,
    nelayan_id,
    total_harga,
    metode_pembayaran,
    status,
    admin_notes
  ) VALUES (
    NEW.id,
    product_nelayan_id,
    NEW.total_harga,
    'cod', -- default payment method
    'pending',
    'Auto-created from order'
  )
  ON CONFLICT (order_id) DO NOTHING; -- Ignore if transaction already exists
  
  RETURN NEW;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_transaction_from_order TO authenticated;
GRANT EXECUTE ON FUNCTION create_transaction_from_order TO anon;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';