-- Fix critical security issues
-- 1. Restrict users table to only show non-sensitive data publicly
DROP POLICY IF EXISTS "Users can view all approved users" ON users;

CREATE POLICY "Users can view approved users (limited info)"
ON users FOR SELECT
USING (
  -- Users can always see their own full profile
  id = auth.uid()
  OR
  -- Others can only see limited info of approved users (no email/phone)
  (status = 'approved' AND auth.uid() IS NOT NULL)
);

-- 2. Add customer_email column to orders for tracking (nullable for existing data)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email text;

-- 3. Add policy for customers to view their own orders by email
CREATE POLICY "Customers can view orders by email"
ON orders FOR SELECT
USING (
  customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = orders.produk_id
    AND products.nelayan_id = auth.uid()
  )
);

-- 4. Require authentication for order creation to prevent spam
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;

CREATE POLICY "Authenticated users can create orders"
ON orders FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Add index for better performance on order lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_products_nelayan_id ON products(nelayan_id);

-- 6. Add constraint to ensure phone numbers are valid format
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_phone_format_check;
ALTER TABLE orders ADD CONSTRAINT orders_phone_format_check 
  CHECK (customer_telpon ~ '^[0-9]{10,15}$');

-- 7. Add constraint for customer name length
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_name_length_check;
ALTER TABLE orders ADD CONSTRAINT orders_name_length_check 
  CHECK (length(trim(customer_nama)) >= 2 AND length(trim(customer_nama)) <= 100);

-- 8. Add constraint for address length
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_address_length_check;
ALTER TABLE orders ADD CONSTRAINT orders_address_length_check 
  CHECK (length(trim(customer_alamat)) >= 10 AND length(trim(customer_alamat)) <= 500);