-- =====================================================
-- COMPLETE MARKETPLACE SCHEMA FOR NELAYAN PLATFORM
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('admin', 'nelayan', 'customer_guest');

-- User status enum  
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending');

-- Pending nelayan status enum
CREATE TYPE pending_status AS ENUM ('pending', 'approved', 'rejected');

-- Product status enum
CREATE TYPE product_status AS ENUM ('active', 'inactive');

-- Order status enum
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'completed', 'cancelled');

-- Transaction status enum
CREATE TYPE transaction_status AS ENUM ('pending', 'success', 'failed');

-- Payment method enum
CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'ewallet', 'cod');

-- =====================================================
-- MAIN TABLES
-- =====================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'customer_guest',
    status user_status NOT NULL DEFAULT 'active',
    full_name TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pending nelayan applications table
CREATE TABLE public.pending_nelayan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    alamat TEXT NOT NULL,
    nomor_telpon TEXT NOT NULL,
    status pending_status NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by UUID REFERENCES public.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_pending_application UNIQUE(user_id),
    CONSTRAINT valid_phone CHECK (LENGTH(nomor_telpon) >= 10)
);

-- Products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nelayan_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nama_produk TEXT NOT NULL,
    deskripsi TEXT,
    harga DECIMAL(12,2) NOT NULL CHECK (harga > 0),
    stok INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
    status product_status NOT NULL DEFAULT 'active',
    image_url TEXT,
    kategori TEXT,
    berat_per_unit DECIMAL(8,2), -- dalam kg
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_products_nelayan FOREIGN KEY (nelayan_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Orders table (for guest customers)
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_nama TEXT NOT NULL,
    customer_telpon TEXT NOT NULL,
    customer_alamat TEXT NOT NULL,
    customer_email TEXT,
    produk_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    jumlah INTEGER NOT NULL CHECK (jumlah > 0),
    harga_satuan DECIMAL(12,2) NOT NULL CHECK (harga_satuan > 0),
    total_harga DECIMAL(12,2) NOT NULL CHECK (total_harga > 0),
    status order_status NOT NULL DEFAULT 'pending',
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_phone CHECK (LENGTH(customer_telpon) >= 10),
    CONSTRAINT valid_total CHECK (total_harga = harga_satuan * jumlah)
);

-- Transactions table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    nelayan_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    total_harga DECIMAL(12,2) NOT NULL CHECK (total_harga > 0),
    metode_pembayaran payment_method NOT NULL DEFAULT 'cod',
    status transaction_status NOT NULL DEFAULT 'pending',
    payment_proof_url TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_order_transaction UNIQUE(order_id),
    -- Foreign key constraint for nelayan
    CONSTRAINT fk_transactions_nelayan FOREIGN KEY (nelayan_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_users_email ON public.users(email);

-- Pending nelayan indexes
CREATE INDEX idx_pending_nelayan_status ON public.pending_nelayan(status);
CREATE INDEX idx_pending_nelayan_user_id ON public.pending_nelayan(user_id);

-- Products indexes
CREATE INDEX idx_products_nelayan_id ON public.products(nelayan_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_kategori ON public.products(kategori);
CREATE INDEX idx_products_created_at ON public.products(created_at DESC);

-- Orders indexes
CREATE INDEX idx_orders_produk_id ON public.orders(produk_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_customer_telpon ON public.orders(customer_telpon);

-- Transactions indexes
CREATE INDEX idx_transactions_order_id ON public.transactions(order_id);
CREATE INDEX idx_transactions_nelayan_id ON public.transactions(nelayan_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.users IS 'Extended user profiles linked to Supabase Auth';
COMMENT ON TABLE public.pending_nelayan IS 'Applications from users wanting to become nelayan (fishermen sellers)';
COMMENT ON TABLE public.products IS 'Fish products listed by approved nelayan';
COMMENT ON TABLE public.orders IS 'Customer orders (no login required)';
COMMENT ON TABLE public.transactions IS 'Payment transactions for orders';

COMMENT ON COLUMN public.users.role IS 'User role: admin, nelayan, or customer_guest';
COMMENT ON COLUMN public.products.stok IS 'Available stock quantity';
COMMENT ON COLUMN public.orders.total_harga IS 'Total price calculated as harga_satuan * jumlah';
COMMENT ON COLUMN public.transactions.metode_pembayaran IS 'Payment method used for the transaction';