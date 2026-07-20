# 🐟 NelayanKu - Marketplace Ikan Segar

**Status**: ✅ **PRODUCTION READY** | **Version**: 1.0.0 | **Last Updated**: January 2025

## 🌟 **Overview**

NelayanKu adalah platform marketplace modern yang menghubungkan nelayan langsung dengan pembeli untuk menjual ikan segar berkualitas tinggi. Dibangun dengan teknologi terbaru dan desain yang responsif.

## 🚀 **Live Demo**

- **Production URL**: [Deploy ke Netlify](https://netlify.com)
- **GitHub Repository**: [jagelkey/laut-cerah-pasar](https://github.com/jagelkey/laut-cerah-pasar)

## ✨ **Fitur Utama**

### 🎯 **User Experience**
- **Responsive Design**: Mobile-first approach dengan Tailwind CSS
- **Real-time Updates**: Live data synchronization dengan Supabase
- **Progressive Web App**: Fast loading dan offline capability
- **Modern UI**: Komponen shadcn/ui yang elegan

### 🔐 **Authentication & Security**
- **Role-based Access**: Nelayan, Pembeli, dan Admin
- **Secure Login**: Supabase Auth dengan JWT
- **Data Protection**: Row Level Security (RLS) policies
- **Input Validation**: Client dan server-side validation

### 🛒 **E-commerce Features**
- **Product Catalog**: Display produk ikan dengan filter
- **Search & Filter**: Pencarian real-time dan filter harga
- **Checkout System**: Proses pemesanan yang seamless
- **Order Management**: Tracking status pesanan real-time

### 📊 **Admin Dashboard**
- **Analytics**: Statistik penjualan dan user activity
- **Product Management**: CRUD operasi untuk produk
- **User Management**: Monitor user activity dan roles
- **Real-time Monitoring**: Live updates untuk semua data

## 🛠️ **Tech Stack**

### **Frontend**
- **React 18** dengan TypeScript
- **Vite** untuk build tooling
- **Tailwind CSS** untuk styling
- **shadcn/ui** untuk komponen UI
- **React Router** untuk routing
- **React Query** untuk state management

### **Backend & Database**
- **Supabase** untuk backend-as-a-service
- **PostgreSQL** untuk database
- **Real-time Subscriptions** untuk live updates
- **Row Level Security** untuk data protection
- **Storage API** untuk file uploads

### **Deployment & DevOps**
- **Netlify** untuk hosting
- **GitHub Actions** untuk CI/CD
- **Environment Management** untuk config
- **Performance Optimization** untuk production

## 📱 **Screenshots**

### **Homepage**
![Homepage](https://via.placeholder.com/800x400/0ea5e9/ffffff?text=Homepage+Preview)

### **Product Catalog**
![Products](https://via.placeholder.com/800x400/10b981/ffffff?text=Product+Catalog)

### **Admin Dashboard**
![Admin](https://via.placeholder.com/800x400/f59e0b/ffffff?text=Admin+Dashboard)

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- npm atau yarn
- Git
- Supabase account

### **Installation**

```bash
# Clone repository
git clone https://github.com/jagelkey/laut-cerah-pasar.git
cd laut-cerah-pasar

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local dengan Supabase credentials

# Run development server
npm run dev

# Build for production
npm run build
```

### **Environment Variables**

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_ENV=development
```

## 🌐 **Deployment**

### **Netlify (Recommended)**

1. **Connect Repository**
   - Login ke [Netlify](https://netlify.com)
   - Connect dengan GitHub repository
   - Set build command: `npm run build`
   - Set publish directory: `dist`

2. **Environment Variables**
   - Set semua environment variables di Netlify dashboard
   - Deploy otomatis saat push ke main branch

3. **Custom Domain**
   - Setup custom domain (opsional)
   - SSL certificate otomatis

### **Manual Deployment**

```bash
# Build production
npm run build

# Deploy dist folder ke hosting provider
# Upload semua file dari folder dist
```

## 📊 **Performance Metrics**

- **Lighthouse Score**: 95+ (Performance, Accessibility, Best Practices, SEO)
- **Bundle Size**: ~576KB (gzipped: ~171KB)
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1

## 🔧 **Development**

### **Available Scripts**

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

### **Project Structure**

```
src/
├── components/       # Reusable UI components
│   ├── ui/          # shadcn/ui components
│   └── dashboard/   # Dashboard-specific components
├── contexts/        # React contexts
├── hooks/           # Custom React hooks
├── integrations/    # External service integrations
├── lib/            # Utility functions
├── pages/          # Page components
└── types/          # TypeScript type definitions
```

## 🐛 **Troubleshooting**

### **Common Issues**

#### **1. Admin Roles Error**
```bash
# Run admin roles fix script
node fix_admin_roles.js
```

#### **2. Build Failures**
```bash
# Clear cache dan reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### **3. Database Connection**
- Verifikasi Supabase credentials
- Check RLS policies
- Test real-time subscriptions

## 📚 **Documentation**

- **[Deployment Guide](NETLIFY_DEPLOYMENT_GUIDE.md)** - Panduan lengkap deployment
- **[Admin Fix Guide](ADMIN_ROLES_FIX_README.md)** - Solusi masalah admin roles
- **[API Documentation](https://supabase.com/docs)** - Supabase API reference

## 🤝 **Contributing**

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **Supabase** untuk backend infrastructure
- **shadcn/ui** untuk komponen UI yang indah
- **Tailwind CSS** untuk utility-first CSS framework
- **Vite** untuk build tooling yang cepat

## 📞 **Support**

- **Issues**: [GitHub Issues](https://github.com/jagelkey/laut-cerah-pasar/issues)
- **Documentation**: [Wiki](https://github.com/jagelkey/laut-cerah-pasar/wiki)
- **Email**: support@nelayanku.com

---

**Made with ❤️ by the NelayanKu Team**

*Empowering fishermen, delivering fresh fish to your table*
