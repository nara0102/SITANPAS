```markdown
# 🗄️ Database Schema & RLS Specification — SITANPAS v2

## 1. Daftar Tabel Utama

### A. Tabel `users`
Menyimpan profil pengguna yang terhubung dengan `auth.users`.
* `id` (`uuid`, Primary Key, Foreign Key $\rightarrow$ `auth.users.id` ON DELETE CASCADE)
* `email` (`text`, Unique, Not Null)
* `role` (`user_role` ENUM: `'admin'`, `'nelayan'`, `'customer_guest'`)
* `status` (`user_status` ENUM: `'active'`, `'inactive'`, `'pending'`)
* `full_name` (`text`), `phone` (`text`), `address` (`text`)
* `created_at`, `updated_at` (`timestamp with time zone`)

### B. Tabel `pending_nelayan`
Antrean verifikasi pendaftaran nelayan oleh Admin.
* `id` (`uuid`, Primary Key, Default `uuid_generate_v4()`)
* `user_id` (`uuid`, Foreign Key $\rightarrow$ `users.id` ON DELETE CASCADE, Unique)
* `nama` (`text`), `alamat` (`text`), `nomor_telpon` (`text`, Check `length >= 10`)
* `status` (`pending_status` ENUM: `'pending'`, `'approved'`, `'rejected'`)
* `admin_notes` (`text`), `reviewed_by` (`uuid`), `reviewed_at` (`timestamp`)

### C. Tabel `products`
Katalog barang dagangan ikan yang diunggah Nelayan.
* `id` (`uuid`, Primary Key)
* `nelayan_id` (`uuid`, Foreign Key $\rightarrow$ `users.id` ON DELETE CASCADE)
* `nama_produk` (`text`), `deskripsi` (`text`), `kategori` (`text`)
* `harga` (`numeric(12,2)`), `stok` (`integer`, Check `>= 0`)
* `unit_type` (`unit_type` ENUM: `'kg'`, `'box'`)
* `status` (`product_status` ENUM: `'active'`, `'inactive'`)
* `image_url` (`text`)

### D. Tabel `orders`
Data pesanan yang dibuat oleh pembeli (*Guest Customer*).
* `id` (`uuid`, Primary Key)
* `customer_nama` (`text`), `customer_telpon` (`text`), `customer_alamat` (`text`)
* `produk_id` (`uuid`, Foreign Key $\rightarrow$ `products.id`)
* `jumlah` (`integer`), `harga_satuan` (`numeric`), `total_harga` (`numeric`)
* `status` (`order_status` ENUM: `'pending'`, `'paid'`, `'shipped'`, `'completed'`, `'cancelled'`)

### E. Tabel `transactions`
Pencatatan arus kas transaksi pesanan.
* `id` (`uuid`, Primary Key)
* `order_id` (`uuid`, Foreign Key $\rightarrow$ `orders.id`, Unique)
* `nelayan_id` (`uuid`, Foreign Key $\rightarrow$ `users.id`)
* `total_harga` (`numeric`), `metode_pembayaran` (`payment_method` ENUM)
* `status` (`transaction_status` ENUM: `'pending'`, `'success'`, `'failed'`)

---

## 2. Trigger & Automated Functions

1. **`handle_new_user_registration()`**
   * **Trigger Event:** `AFTER INSERT ON auth.users`
   * **Fungsi:** Menyalin pendaftar baru ke `public.users` dan memasukkan ke `pending_nelayan` jika tipe pendaftaran adalah nelayan.
2. **`reduce_product_stock()`**
   * **Trigger Event:** `AFTER INSERT ON public.orders`
   * **Fungsi:** Mengurangi stok di `products` sesuai jumlah beli. Jika stok $= 0$, status produk otomatis menjadi `'inactive'`.
3. **`restore_product_stock()`**
   * **Trigger Event:** `AFTER UPDATE ON public.orders`
   * **Fungsi:** Mengembalikan stok produk jika status pesanan diubah menjadi `'cancelled'`.
4. **`create_transaction_for_order()`**
   * **Trigger Event:** `AFTER INSERT ON public.orders`
   * **Fungsi:** Membuat baris transaksi baru di tabel `transactions` secara otomatis saat pesanan baru masuk.

---

## 3. Kebijakan Row Level Security (RLS)

* **Public / Unauthenticated Users (`anon`):**
  * `SELECT` pada `products` di mana `status = 'active'`.
  * `INSERT` pada `orders` untuk pemesanan *guest*.
* **Nelayan (`authenticated` with role `'nelayan'`):**
  * `ALL` (CRUD) pada `products` di mana `nelayan_id = auth.uid()`.
  * `SELECT` pada `orders` & `transactions` terkait produk milik nelayan.
* **Admin (`authenticated` with role `'admin'`):**
  * Full Access (Read, Write, Update, Delete) di seluruh tabel, *views*, dan *storage buckets*.