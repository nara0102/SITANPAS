# 🚀 Deployment Guide — SITANPAS v2

## Continuous Deployment (Automatic via GitHub)

1. Lakukan perubahan kode di VS Code.
2. Jalankan pengujian build lokal:

   ```bash
   npm run build
   ```

3. push kode ke branch utama

    ```bash
    git add .
    git commit -m "feat: [deskripsi perubahan]"
    git push origin main
    ```

4. Netlify akan otomatis mendeteksi commit baru, mengeksekusi npm run build, dan memperbarui situs web secara otomatis dalam 1–2 menit

---

## Environment Variables di Netlify

* VITE_SUPABASE_URL
* VITE_SUPABASE_ANON_KEY
