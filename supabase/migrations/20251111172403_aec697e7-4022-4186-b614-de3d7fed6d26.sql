-- Create users table for additional user information
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  role TEXT NOT NULL CHECK (role IN ('nelayan', 'admin', 'customer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nelayan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_produk TEXT NOT NULL,
  deskripsi TEXT,
  harga NUMERIC(10,2) NOT NULL CHECK (harga >= 0),
  stok INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  kategori TEXT NOT NULL,
  berat_per_unit NUMERIC(10,2) NOT NULL CHECK (berat_per_unit > 0),
  unit_type TEXT NOT NULL DEFAULT 'kg' CHECK (unit_type IN ('kg', 'box')),
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produk_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_nama TEXT NOT NULL,
  customer_telpon TEXT NOT NULL,
  customer_alamat TEXT NOT NULL,
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  harga_satuan NUMERIC(10,2) NOT NULL CHECK (harga_satuan >= 0),
  total_harga NUMERIC(10,2) NOT NULL CHECK (total_harga >= 0),
  catatan TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all approved users"
  ON public.users FOR SELECT
  USING (status = 'approved' OR id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

-- RLS Policies for products table
CREATE POLICY "Anyone can view active products"
  ON public.products FOR SELECT
  USING (status = 'active');

CREATE POLICY "Nelayan can insert their own products"
  ON public.products FOR INSERT
  WITH CHECK (nelayan_id = auth.uid());

CREATE POLICY "Nelayan can update their own products"
  ON public.products FOR UPDATE
  USING (nelayan_id = auth.uid());

CREATE POLICY "Nelayan can delete their own products"
  ON public.products FOR DELETE
  USING (nelayan_id = auth.uid());

-- RLS Policies for orders table
CREATE POLICY "Nelayan can view orders for their products"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = orders.produk_id
      AND products.nelayan_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Nelayan can update orders for their products"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = orders.produk_id
      AND products.nelayan_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_products_nelayan_id ON public.products(nelayan_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_orders_produk_id ON public.orders(produk_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();