import { z } from 'zod';

// Order validation schema
export const orderSchema = z.object({
  customerName: z.string()
    .trim()
    .min(2, { message: "Nama harus minimal 2 karakter" })
    .max(100, { message: "Nama maksimal 100 karakter" })
    .regex(/^[a-zA-Z\s.'-]+$/, { message: "Nama hanya boleh berisi huruf, spasi, dan karakter . ' -" }),
  
  whatsappNumber: z.string()
    .trim()
    .min(10, { message: "Nomor WhatsApp harus minimal 10 digit" })
    .max(15, { message: "Nomor WhatsApp maksimal 15 digit" })
    .regex(/^[0-9+]+$/, { message: "Nomor WhatsApp hanya boleh berisi angka dan +" }),
  
  customerEmail: z.string()
    .trim()
    .toLowerCase()
    .email({ message: "Email tidak valid" })
    .max(255, { message: "Email maksimal 255 karakter" }),
  
  address: z.string()
    .trim()
    .min(10, { message: "Alamat harus minimal 10 karakter" })
    .max(500, { message: "Alamat maksimal 500 karakter" }),
  
  quantity: z.number()
    .int({ message: "Jumlah harus berupa bilangan bulat" })
    .min(1, { message: "Jumlah harus minimal 1" })
    .max(1000, { message: "Jumlah maksimal 1000 unit per transaksi" }),
});

// Sign up validation schema
export const signUpSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email({ message: "Email tidak valid" })
    .max(255, { message: "Email maksimal 255 karakter" }),
  
  password: z.string()
    .min(8, { message: "Password minimal 8 karakter" })
    .max(100, { message: "Password maksimal 100 karakter" })
    .regex(/[A-Z]/, { message: "Password harus mengandung minimal 1 huruf kapital" })
    .regex(/[a-z]/, { message: "Password harus mengandung minimal 1 huruf kecil" })
    .regex(/[0-9]/, { message: "Password harus mengandung minimal 1 angka" }),
  
  fullName: z.string()
    .trim()
    .min(2, { message: "Nama harus minimal 2 karakter" })
    .max(100, { message: "Nama maksimal 100 karakter" })
    .regex(/^[a-zA-Z\s.'-]+$/, { message: "Nama hanya boleh berisi huruf, spasi, dan karakter . ' -" }),
  
  phone: z.string()
    .trim()
    .min(10, { message: "Nomor telepon harus minimal 10 digit" })
    .max(15, { message: "Nomor telepon maksimal 15 digit" })
    .regex(/^[0-9+]+$/, { message: "Nomor telepon hanya boleh berisi angka dan +" }),
  
  location: z.string()
    .trim()
    .min(2, { message: "Lokasi harus minimal 2 karakter" })
    .max(255, { message: "Lokasi maksimal 255 karakter" }),
});

// Sign in validation schema
export const signInSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email({ message: "Email tidak valid" }),
  
  password: z.string()
    .min(1, { message: "Password tidak boleh kosong" }),
});

// Product validation schema
export const productSchema = z.object({
  nama_produk: z.string()
    .trim()
    .min(2, { message: "Nama produk harus minimal 2 karakter" })
    .max(255, { message: "Nama produk maksimal 255 karakter" }),
  
  deskripsi: z.string()
    .trim()
    .max(1000, { message: "Deskripsi maksimal 1000 karakter" })
    .optional()
    .or(z.literal('')),
  
  harga: z.number()
    .min(100, { message: "Harga minimal Rp 100" })
    .max(999999999, { message: "Harga maksimal Rp 999,999,999" }),
  
  stok: z.number()
    .int({ message: "Stok harus berupa bilangan bulat" })
    .min(0, { message: "Stok tidak boleh negatif" })
    .max(999999, { message: "Stok maksimal 999,999" }),
  
  kategori: z.string()
    .trim()
    .min(2, { message: "Kategori harus minimal 2 karakter" })
    .max(100, { message: "Kategori maksimal 100 karakter" }),
  
  berat_per_unit: z.number()
    .min(0.01, { message: "Berat harus minimal 0.01 kg" })
    .max(1000, { message: "Berat maksimal 1000 kg" }),
  
  unit_type: z.enum(['kg', 'box'], { 
    message: "Tipe unit harus 'kg' atau 'box'" 
  }),
});
