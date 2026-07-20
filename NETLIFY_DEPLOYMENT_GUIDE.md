# 🚀 Panduan Deployment Netlify - Laut Cerah Pasar

## 📋 Persiapan Deployment

### 1. Environment Variables yang Diperlukan

Sebelum deploy ke Netlify, pastikan Anda memiliki environment variables berikut:

```bash
# Supabase Configuration (WAJIB)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional - untuk optimasi build
NODE_ENV=production
CI=true
GENERATE_SOURCEMAP=false
```

### 2. Cara Mendapatkan Supabase Credentials

1. Login ke [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project Anda
3. Pergi ke **Settings** → **API**
4. Copy **Project URL** dan **anon public key**

## 🔧 Langkah-langkah Deployment

### Opsi 1: Deploy via Git (Recommended)

1. **Push ke GitHub/GitLab**

   ```bash
   git add .
   git commit -m "Ready for Netlify deployment"
   git push origin main
   ```

2. **Connect ke Netlify**

   - Login ke [Netlify](https://netlify.com)
   - Klik "New site from Git"
   - Pilih repository Anda
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **Set Environment Variables**
   - Pergi ke Site settings → Environment variables
   - Tambahkan semua environment variables yang diperlukan

### Opsi 2: Manual Deploy

1. **Build Project**

   ```bash
   npm run build
   ```

2. **Upload ke Netlify**
   - Drag & drop folder `dist` ke Netlify dashboard
   - Atau gunakan Netlify CLI:
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

## ⚙️ Konfigurasi Netlify

File `netlify.toml` sudah dikonfigurasi dengan:

- ✅ **Build settings** yang optimal
- ✅ **Security headers** lengkap
- ✅ **Caching strategy** untuk performa
- ✅ **SPA routing** support
- ✅ **Content Security Policy**

## 🔍 Verifikasi Deployment

Setelah deployment berhasil, pastikan:

1. **✅ Homepage** loading dengan benar
2. **✅ Authentication** berfungsi (login/register)
3. **✅ Dashboard** dapat diakses
4. **✅ Admin panel** berfungsi
5. **✅ Database connection** aktif
6. **✅ ThingSpeak integration** bekerja

## 🚨 Troubleshooting

### Build Errors

```bash
# Clear cache dan rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Environment Variables Issues

- Pastikan semua VITE\_ prefix ada
- Cek tidak ada typo di nama variable
- Verifikasi Supabase credentials valid

### Routing Issues

- Pastikan `_redirects` file ada di public folder
- Cek netlify.toml redirect rules

### Database Connection

- Verifikasi Supabase URL dan key
- Cek RLS policies di Supabase
- Test connection di browser console

## 📊 Performance Optimizations

Project sudah dioptimasi dengan:

- **Code splitting** otomatis
- **Asset compression** via Vite
- **Caching headers** untuk static assets
- **Lazy loading** untuk komponen besar
- **Bundle size optimization**

## 🔐 Security Features

- **Content Security Policy** configured
- **XSS Protection** enabled
- **Frame Options** set to DENY
- **HTTPS** enforced
- **Secure headers** implemented

## 📱 Mobile & PWA Ready

- **Responsive design** untuk semua device
- **Touch-friendly** interface
- **Fast loading** dengan optimasi bundle
- **Offline capability** (jika diperlukan)

## 🎯 Post-Deployment Checklist

- [ ] Domain custom (opsional)
- [ ] SSL certificate aktif
- [ ] Analytics setup (Google Analytics, dll)
- [ ] Error monitoring (Sentry, dll)
- [ ] Performance monitoring
- [ ] Backup strategy

## 📞 Support

Jika mengalami masalah deployment:

1. Cek build logs di Netlify dashboard
2. Verifikasi environment variables
3. Test build locally: `npm run build && npm run preview`
4. Cek browser console untuk errors

---

**🎉 Selamat! Aplikasi Laut Cerah Pasar siap di-deploy ke Netlify!**
