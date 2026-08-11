# 🏗️ Technical Architecture & Environment — SITANPAS v2

## 1. Spesifikasi Tech Stack
* **Front-End Framework:** React `v18.3.x`
* **Build Tool & Bundler:** Vite `v5.x`
* **Language:** TypeScript `v5.x`
* **Styling & UI Components:** Tailwind CSS `v3.x` + Shadcn UI / Radix UI
* **Back-End as a Service (BaaS):** Supabase (PostgreSQL 15, Auth JWT, Storage)
* **Hardware Integration:** ThingSpeak API (Fetch Data Timbangan IoT ESP32)
* **Runtime Environment:** Node.js `v20.x LTS`
* **Hosting / CD:** Netlify (Global Edge Network)

---

## 2. Struktur Folder Proyek
```text
SITANPAS/
├── md/                         # File dokumentasi proyek (PRD.md, ARCHITECTURE.md, SCHEMA.md)
├── node_modules/               # Package dependencies proyek
├── public/                     # Static assets (logo, favicon, _redirects)
├── src/                        # Source code utama aplikasi React
│   ├── assets/                 # Resource gambar, ikon, dan media
│   ├── components/             # Reusable UI Components
│   │   ├── dashboard/          # Komponen khusus antarmuka Nelayan & Admin
│   │   ├── ui/                 # Basic UI Primitives (Shadcn/Radix components)
│   │   ├── DashboardErrorBoundary.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── ThingSpeakWeightFetcher.tsx  # Integrasi data timbangan IoT
│   ├── contexts/               # React State Contexts
│   │   ├── AuthContext.tsx     # Manajemen Sesi Auth & Role
│   │   └── AuthContextType.ts  # Type Definitions Auth
│   ├── debug/                  # Komponen pengujian UI & perbaikan visual
│   │   └── FlickerTest.tsx
│   ├── hooks/                  # Custom React Hooks
│   ├── integrations/
│   │   └── supabase/           # Inisialisasi Klien Supabase & Tipe Auto-Generated
│   │       ├── client.ts
│   │       └── types.ts
│   ├── lib/                    # Utility libraries & Helper functions
│   ├── pages/                  # Halaman aplikasi (Landing, Auth, Admin, Dashboard)
│   ├── utils/                  # Functions pemicu & helper format data
│   ├── App.css                 # Style spesifik aplikasi
│   ├── App.tsx                 # Root Router & Otorisasi Navigasi
│   ├── index.css               # Import Tailwind CSS & Global Styling
│   ├── main.tsx                # Entry point React Virtual DOM
│   └── vite-env.d.ts           # Type deklarasi Environment Vite
├── supabase/
│   └── migrations/             # Migration SQL database Supabase (V2 Clean)
├── .env                        # Environment Variable Lokal (URL & Keys)
├── .gitignore                  # Git Exclusion Rules
├── components.json             # Konfigurasi Shadcn UI
├── eslint.config.js            # Linter Rules
├── index.html                  # HTML Shell Utama
├── netlify.toml                # Konfigurasi SPA Redirects & Security Headers Netlify
├── package-lock.json           # Exact Dependency Lock
├── package.json                # Project Manifest & Scripts
├── postcss.config.js           # Konfigurasi PostCSS
├── README.md                   # Panduan Ringkas Proyek
├── tailwind.config.ts          # Konfigurasi Tema & Warna Tailwind CSS
├── tsconfig.app.json           # Config TypeScript Aplikasi
├── tsconfig.json               # Config Root TypeScript
├── tsconfig.node.json          # Config TypeScript Node Environment
└── vite.config.ts              # Bundler Build Config
```

---

## 3 . Konfigurasi Environment Variables (.env.example)
#Supabase Configuration
VITE_SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
VITE_SUPABASE_ANON_KEY=your-anon-key-here

#Application Metadata
VITE_APP_NAME="SITANPAS v2"
VITE_APP_VERSION="2.0.0"
VITE_APP_ENVIRONMENT=production

---

## 4. Alur Deployment (Netlify & Supabase)
1. Database & Backend: Dikelola penuh di Supabase Cloud. Seluruh skema, triggers, dan RLS dieksekusi melalui file `supabase/migrations/20260811145741_sitanpas_v2_init.sql.`
2. Storage Bucket: Bucket `fish-photos` dikonfigurasi sebagai Public dengan RLS insert restriction untuk pengguna tersertifikasi.
3. Frontend CD (Netlify):
    * GitHub Repository dihubungkan ke Netlify.
    * Build Command: npm run build
    * Publish Directory: dist
    * SPA Routing Fix: Didukung oleh file public/_redirects (/* /index.html 200).