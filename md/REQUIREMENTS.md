# 📋 System & Environment Requirements — SITANPAS v2

Dokumen ini mencakup seluruh kebutuhan perangkat lunak (*software*), perangkat keras (*hardware*), dan spesifikasi lingkungan kerja yang dibutuhkan untuk menjalankan dan menguji **SITANPAS v2**.

---

## 💻 1. Minimum System Requirements (Development)

Untuk menjalankan dan mengembangkan aplikasi ini di komputer/laptop lokal:

* **Operating System:** Windows 10/11, macOS (Monterey atau terbaru), atau Linux (Ubuntu 20.04+)
* **Node.js:** Runtime v20.x LTS (Recommended)
* **Package Manager:** npm v10.x atau yarn v1.22+
* **Version Control:** Git v2.30+
* **Code Editor:** Visual Studio Code (dengan ekstensi rekomendasi: *Tailwind CSS IntelliSense*, *ESLint*, *TypeScript*)

---

## 🌐 2. Cloud & BaaS Services

Layanan cloud yang wajib disiapkan sebelum instalasi aplikasi:

* **Supabase Service:**
  * PostgreSQL 15 Database Instance
  * Supabase Auth Service
  * Supabase Storage Bucket (`fish-photos` - Public Access)
* **Hosting / CD Platform:** Netlify (Global CDN & Edge Network)
* **IoT Data Service:** ThingSpeak API (untuk penarikan data timbangan digital)

---

## 🔌 3. Hardware Requirements (IoT & Bagan Network)

Perangkat keras yang dipasang pada bagan nelayan dan posko darat:

1. **Mikrokontroler Utama:** Raspberry Pi 5 / ESP32 Dev Module
2. **Sensor Timbangan:** Sensor Load Cell (Kapasitas disesuaikan) + Modul Amplifier HX711
3. **Konektivitas Laut:** Modem Router 4G Outdoor
4. **Display Monitor:** Monitor Display LED/LCD (posko darat)

---

## 📦 4. Software Dependencies (Frontend Stack)

Seluruh dependensi perpustakaan kode JavaScript/TypeScript dikelola via `package.json`:

### Dependencies Utama

* `react` & `react-dom` (`v18.3.x`) — Framework UI Utama
* `@supabase/supabase-js` — SDK Integrasi Supabase BaaS
* `react-router-dom` — Manajemen Navigasi & Routing SPA
* `lucide-react` — Ikonografi Antarmuka
* `tailwindcss` (`v3.x`) — Utility-first CSS Framework
* `@radix-ui/*` — Basic Primitives UI Components

### Development Dependencies

* `typescript` (`v5.x`) — Type Safety Compiler
* `vite` (`v5.x`) — Bundler & Local Development Server
* `postcss` & `autoprefixer` — CSS Processing
