# 📄 Product Requirement Document (PRD) — SITANPAS v2

## 1. Deskripsi Proyek
**SITANPAS v2** (Sistem Informasi Transaksi Hasil Laut Pasang) adalah platform *digital marketplace* berbasis web yang dirancang untuk memodernisasi ekosistem perdagangan hasil laut di Palu, Sulawesi Tengah. Platform ini menghubungkan nelayan lokal secara langsung dengan pembeli publik, dilengkapi integrasi data penimbangan (IoT ESP32), verifikasi penjual berbasis persetujuan admin, serta manajemen stok dan transaksi otomatis.

## 2. Target Pengguna
1. **Public Customer (Pembeli):** Masyarakat umum yang membeli hasil laut segar secara langsung tanpa kewajiban pendaftaran akun (*Guest Checkout*).
2. **Nelayan (Penjual):** Nelayan lokal yang mendaftar untuk menjual hasil tangkapannya setelah diverifikasi oleh Admin.
3. **Admin Marketplace:** Pengelola platform yang memverifikasi akun nelayan, memantau transaksi harian, dan mengelola katalog umum.

## 3. Daftar Fitur Utama
* **Autentikasi & Otorisasi:**
  * Login/Register multi-peran (*Admin*, *Nelayan*, *Customer Guest*).
  * Sistem antrean persetujuan pendaftaran Nelayan (*Approval System*).
* **Manajemen Produk & Stok (Nelayan):**
  * CRUD Produk Ikan (Nama, Harga, Stok, Foto, Kategori, Berat Per Unit).
  * Pengunggahan foto produk ke Supabase Storage Bucket (`fish-photos`).
  * Integrasi data timbangan digital IoT (ESP32).
* **Pemesanan Publik (*Guest Checkout*):**
  * Katalog produk interaktif tanpa *login*.
  * Form pemesanan langsung (*COD/Transfer*) dengan pengurangan stok otomatis.
* **Dashboard Analitikal (Admin):**
  * Verifikasi Nelayan Baru (*Pending*, *Approve*, *Reject*).
  * Pemantauan laporan transaksi harian, bulanan, dan performa nelayan via *Database Views*.

## 4. User Flow Utama

### A. Alur Pembeli (Guest Checkout Flow)
1. Pembeli membuka *Landing Page* SITANPAS v2 $\rightarrow$ Memilih produk ikan.
2. Klik **Beli Sekarang** $\rightarrow$ Mengisi Modal Form (*Nama, Telepon, Alamat, Jumlah*).
3. Klik **Konfirmasi Pesanan** $\rightarrow$ Sistem membuat data di `orders` & `transactions` serta memicu *trigger* pengurangan stok otomatis.

### B. Alur Nelayan (Fisherman Onboarding Flow)
1. Nelayan mendaftar via Form Registrasi dengan opsi peran *Nelayan*.
2. Akun masuk ke antrean `pending_nelayan` dengan status `pending` di `public.users`.
3. Setelah disetujui Admin, status berubah menjadi `active` dan *role* menjadi `nelayan`.
4. Nelayan *login* $\rightarrow$ Mengakses Dashboard Nelayan $\rightarrow$ Mengunggah produk & mengelola pesanan masuk.

### C. Alur Admin (Management & Approval Flow)
1. Admin *login* $\rightarrow$ Mengakses Dashboard Admin.
2. Membuka tab **Kelola Nelayan** $\rightarrow$ Meninjau antrean di tab **Menunggu**.
3. Menekan tombol **Setujui / Approve** $\rightarrow$ Sistem mengeksekusi fungsi SQL untuk mengaktifkan akun Nelayan.