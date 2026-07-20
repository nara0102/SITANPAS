-- Fix permissions for products table and other tables
-- Grant proper permissions to anon and authenticated roles

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_nelayan TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_nelayan TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_settings TO authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant function permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Ensure RLS policies are simple and permissive
DROP POLICY IF EXISTS "allow_all_products" ON public.products;
CREATE POLICY "allow_all_products" ON public.products 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_users" ON public.users;
CREATE POLICY "allow_all_users" ON public.users 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_orders" ON public.orders;
CREATE POLICY "allow_all_orders" ON public.orders 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_transactions" ON public.transactions;
CREATE POLICY "allow_all_transactions" ON public.transactions 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_pending_nelayan" ON public.pending_nelayan;
CREATE POLICY "allow_all_pending_nelayan" ON public.pending_nelayan 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_website_settings" ON public.website_settings;
CREATE POLICY "allow_all_website_settings" ON public.website_settings 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Refresh schema
NOTIFY pgrst, 'reload schema';

-- Add some test data if products table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.products LIMIT 1) THEN
    -- Insert a test product if no products exist
    INSERT INTO public.products (
      id,
      nelayan_id,
      nama_produk,
      deskripsi,
      harga,
      stok,
      status,
      kategori,
      berat_per_unit
    ) 
    SELECT 
      gen_random_uuid(),
      u.id,
      'Ikan Kakap Merah',
      'Ikan kakap merah segar hasil tangkapan hari ini',
      75000,
      10,
      'active',
      'Ikan Laut',
      1.0
    FROM public.users u 
    WHERE u.role = 'nelayan' 
    LIMIT 1;
  END IF;
END $$;