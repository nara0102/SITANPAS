# Database Schema Lengkap - Platform Nelayan

## 📋 Ringkasan Schema

Schema database ini dirancang untuk platform marketplace nelayan dengan fitur:
- **Customer tanpa login** dapat membeli produk langsung
- **Nelayan** harus mendaftar dan disetujui admin
- **Admin** mengelola persetujuan nelayan dan monitoring transaksi

## 🗂️ File Migration yang Dibuat

1. **`20250120000022_complete_marketplace_schema.sql`** - Schema utama dengan semua tabel
2. **`20250120000023_functions_and_triggers.sql`** - Fungsi dan trigger otomatisasi
3. **`20250120000024_rls_policies.sql`** - Kebijakan keamanan berbasis role
4. **`20250120000025_admin_views_reports.sql`** - View untuk laporan admin

## 📊 Struktur Tabel

### 1. Tabel `users`
```sql
- id (UUID, PK) - Link ke auth.users
- email (TEXT, UNIQUE)
- role (ENUM: admin, nelayan, customer_guest)
- status (ENUM: active, inactive, pending)
- full_name, phone, address (TEXT)
- created_at, updated_at (TIMESTAMP)
```

### 2. Tabel `pending_nelayan`
```sql
- id (UUID, PK)
- user_id (UUID, FK ke users)
- nama, alamat, nomor_telpon (TEXT)
- status (ENUM: pending, approved, rejected)
- admin_notes (TEXT)
- reviewed_by (UUID, FK ke users)
- reviewed_at, created_at, updated_at (TIMESTAMP)
```

### 3. Tabel `products`
```sql
- id (UUID, PK)
- nelayan_id (UUID, FK ke users)
- nama_produk, deskripsi, kategori (TEXT)
- harga (DECIMAL)
- stok (INTEGER)
- status (ENUM: active, inactive)
- image_url (TEXT)
- berat_per_unit (DECIMAL)
- created_at, updated_at (TIMESTAMP)
```

### 4. Tabel `orders`
```sql
- id (UUID, PK)
- customer_nama, customer_telpon, customer_alamat (TEXT)
- customer_email (TEXT, optional)
- produk_id (UUID, FK ke products)
- jumlah (INTEGER)
- harga_satuan, total_harga (DECIMAL)
- status (ENUM: pending, paid, shipped, completed, cancelled)
- catatan (TEXT)
- created_at, updated_at (TIMESTAMP)
```

### 5. Tabel `transactions`
```sql
- id (UUID, PK)
- order_id (UUID, FK ke orders)
- nelayan_id (UUID, FK ke users)
- total_harga (DECIMAL)
- metode_pembayaran (ENUM: cash, transfer, ewallet, cod)
- status (ENUM: pending, success, failed)
- payment_proof_url, admin_notes (TEXT)
- created_at, updated_at (TIMESTAMP)
```

## ⚙️ Fungsi dan Trigger Otomatis

### Fungsi Persetujuan Nelayan
- `approve_nelayan_application()` - Menyetujui aplikasi nelayan
- `reject_nelayan_application()` - Menolak aplikasi nelayan

### Manajemen Stok Otomatis
- **Trigger**: Ketika order dibuat → stok produk berkurang
- **Trigger**: Ketika stok = 0 → status produk menjadi 'inactive'
- **Trigger**: Ketika order dibatalkan → stok dikembalikan

### Manajemen Transaksi
- **Trigger**: Ketika order dibuat → transaksi otomatis terbuat
- **Trigger**: Update timestamp otomatis untuk semua tabel

### Profil User Otomatis
- **Trigger**: Ketika user baru di auth.users → profil di public.users terbuat

## 🔒 Row Level Security (RLS)

### Akses Public (Tanpa Login)
- ✅ Lihat produk aktif
- ✅ Buat order baru

### Akses Nelayan
- ✅ Lihat/edit produk sendiri
- ✅ Lihat order untuk produk sendiri
- ✅ Lihat transaksi sendiri
- ✅ Update status order/transaksi sendiri

### Akses Admin
- ✅ Lihat semua data
- ✅ Edit semua data
- ✅ Setujui/tolak aplikasi nelayan
- ✅ Akses semua laporan dan analytics

## 📈 View untuk Admin Dashboard

### 1. `admin_nelayan_performance`
Performa setiap nelayan:
- Total produk, transaksi, revenue
- Success rate, average order value
- Status aktif/tidak aktif

### 2. `admin_product_analytics`
Analytics produk:
- Penjualan per produk
- Status stok (high/medium/low/out)
- Revenue per produk

### 3. `admin_daily_transactions`
Laporan transaksi harian:
- Total transaksi per hari
- Breakdown metode pembayaran
- Success/pending/failed rate

### 4. `admin_customer_analytics`
Analisis customer:
- Repeat customers vs new customers
- Total spending per customer
- Customer classification (VIP/Regular/New)

### 5. `admin_pending_applications`
Aplikasi nelayan pending:
- Data lengkap aplikasi
- Lama waktu pending
- Status review

### 6. `admin_system_overview`
Overview sistem:
- Total users, products, orders
- Statistik real-time
- Health monitoring

### 7. `admin_monthly_revenue`
Laporan revenue bulanan:
- Revenue per bulan
- Breakdown payment method
- Trend pertumbuhan

## 🚀 Cara Implementasi

### 1. Jalankan Migration (Jika Supabase CLI tersedia)
```bash
npx supabase db reset
```

### 2. Manual di Supabase Dashboard
1. Buka Supabase Dashboard → SQL Editor
2. Jalankan file migration secara berurutan:
   - `20250120000022_complete_marketplace_schema.sql`
   - `20250120000023_functions_and_triggers.sql`
   - `20250120000024_rls_policies.sql`
   - `20250120000025_admin_views_reports.sql`

### 3. Buat Admin User Manual
```sql
-- Di Supabase Auth, buat user baru kemudian update role:
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'admin@example.com';
```

## 🔄 Alur Transaksi

### Customer Membeli (Tanpa Login)
1. Customer lihat produk di halaman utama
2. Customer isi form order (nama, telp, alamat)
3. **Trigger**: Stok produk berkurang otomatis
4. **Trigger**: Transaksi record terbuat otomatis
5. Nelayan dapat notifikasi order baru

### User Jadi Nelayan
1. User daftar akun biasa (role: customer_guest)
2. User submit aplikasi ke `pending_nelayan`
3. Admin review dan approve/reject
4. **Fungsi**: Role user berubah jadi 'nelayan'
5. Nelayan bisa login dan upload produk

### Admin Dashboard
1. Admin login → redirect ke dashboard
2. Lihat semua analytics via views
3. Approve/reject aplikasi nelayan
4. Monitor transaksi dan revenue
5. Kontrol stok produk nelayan

## 📝 Catatan Implementasi

- **Semua migration sudah siap** di folder `supabase/migrations/`
- **RLS policies** memastikan keamanan data per role
- **Triggers** mengotomatisasi business logic
- **Views** menyediakan analytics real-time
- **Indexes** dioptimalkan untuk performa query

Schema ini siap digunakan untuk platform marketplace nelayan dengan semua fitur yang diminta!