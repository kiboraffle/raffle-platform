# 🚀 Deployment Guide - Vercel & GitHub

Panduan lengkap untuk deploy Platform Undian Digital ke Vercel dengan integrasi GitHub.

## 📋 Prerequisites

- [x] Akun GitHub
- [x] Akun Vercel
- [x] Supabase project sudah setup
- [x] WhatsApp Business API credentials
- [x] Midtrans account credentials

## 🔧 Setup GitHub Repository

### 1. Initialize Git Repository

```bash
# Initialize git repository
git init

# Add all files
git add .

# Initial commit
git commit -m "Initial commit: Platform Undian Digital with Supabase"
```

### 2. Create GitHub Repository

1. **Buka [GitHub](https://github.com) dan login**
2. **Klik "New repository"**
3. **Repository name:** `raffle-platform` (atau nama yang Anda inginkan)
4. **Description:** `Platform Undian Digital Komersial dengan Supabase`
5. **Set sebagai Private** (untuk keamanan)
6. **Jangan centang "Initialize with README"** (karena sudah ada)
7. **Klik "Create repository"**

### 3. Connect Local Repository to GitHub

```bash
# Add remote origin
git remote add origin https://github.com/YOUR_USERNAME/raffle-platform.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 🌐 Deploy ke Vercel

### 1. Connect GitHub to Vercel

1. **Login ke [Vercel](https://vercel.com)**
2. **Klik "New Project"**
3. **Import dari GitHub repository**
4. **Pilih repository `raffle-platform`**
5. **Configure project:**
   - **Framework Preset:** Other
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (akan otomatis detect)
   - **Output Directory:** `build` (akan otomatis detect)

### 2. Environment Variables Setup

Di Vercel Dashboard → Project Settings → Environment Variables, tambahkan:

```env
# Database (Supabase)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_for_production
JWT_EXPIRE=7d

# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_API_TOKEN=your_whatsapp_api_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token

# Midtrans Payment Gateway
MIDTRANS_SERVER_KEY=your_midtrans_server_key
MIDTRANS_CLIENT_KEY=your_midtrans_client_key
MIDTRANS_IS_PRODUCTION=false

# Application URLs
FRONTEND_URL=https://your-app-name.vercel.app

# Security
BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# OTP Configuration
OTP_LENGTH=6
OTP_EXPIRY_MINUTES=5

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp

# Email Configuration (Optional)
EMAIL_FROM=noreply@raffleplatform.com
EMAIL_FROM_NAME=Raffle Platform

# Raffle Configuration
MAX_RAFFLE_DURATION_DAYS=90
MIN_TICKET_PRICE=1000
MAX_TICKET_PRICE=10000000
MAX_TICKETS_PER_RAFFLE=100000
```

### 3. Deploy

1. **Klik "Deploy"**
2. **Tunggu proses build selesai**
3. **Vercel akan memberikan URL deployment**

## 🔄 Continuous Deployment

### Auto-Deploy dari GitHub

Setelah setup awal, setiap push ke branch `main` akan otomatis trigger deployment baru:

```bash
# Make changes to your code
git add .
git commit -m "Update: description of changes"
git push origin main

# Vercel akan otomatis deploy perubahan
```

### Branch-based Deployments

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "Add: new feature"
git push origin feature/new-feature

# Vercel akan create preview deployment untuk branch ini
```

## 📁 Project Structure untuk Vercel

```
raffle-platform/
├── server.js              # Backend API entry point
├── vercel.json            # Vercel configuration
├── package.json           # Backend dependencies
├── client/                # Frontend React app
│   ├── package.json       # Frontend dependencies
│   ├── public/
│   ├── src/
│   └── build/            # Generated after build
├── config/
├── models/
├── routes/
├── middleware/
├── utils/
└── uploads/
```

## 🔧 Vercel Configuration Explained

### `vercel.json` Breakdown:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",        // Backend API
      "use": "@vercel/node"
    },
    {
      "src": "client/package.json", // Frontend React
      "use": "@vercel/static-build"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",         // API routes ke backend
      "dest": "/server.js"
    },
    {
      "src": "/(.*)",             // Static files ke frontend
      "dest": "/client/$1"
    }
  ]
}
```

## 🌍 Custom Domain (Optional)

### 1. Add Custom Domain di Vercel

1. **Vercel Dashboard → Project → Settings → Domains**
2. **Add domain:** `raffleplatform.com`
3. **Configure DNS records** sesuai instruksi Vercel

### 2. Update Environment Variables

```env
FRONTEND_URL=https://raffleplatform.com
```

## 📊 Monitoring & Analytics

### Vercel Analytics

1. **Enable Vercel Analytics** di project settings
2. **Monitor performance** dan usage
3. **Track deployment** success/failure

### Error Monitoring

```javascript
// Add to server.js for error tracking
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
```

## 🔒 Security Best Practices

### Environment Variables
- ✅ Semua secrets disimpan di Vercel Environment Variables
- ✅ Tidak ada credentials di code
- ✅ Different keys untuk development dan production

### HTTPS & CORS
- ✅ Vercel otomatis provide HTTPS
- ✅ CORS dikonfigurasi untuk domain production
- ✅ Rate limiting untuk API endpoints

## 🚨 Troubleshooting

### Common Issues

**1. Build Failed**
```bash
# Check build logs di Vercel Dashboard
# Pastikan semua dependencies terinstall
npm install
npm run build
```

**2. API Routes Not Working**
```bash
# Pastikan vercel.json routes configuration benar
# Check function logs di Vercel Dashboard
```

**3. Environment Variables Not Loading**
```bash
# Pastikan semua env vars sudah diset di Vercel
# Redeploy setelah menambah env vars
```

**4. Database Connection Issues**
```bash
# Check Supabase connection string
# Verify Supabase project is active
# Check network policies di Supabase
```

### Debug Commands

```bash
# Local development
npm run dev

# Build test
npm run build

# Check logs
vercel logs your-deployment-url

# Local Vercel simulation
vercel dev
```

## 📈 Performance Optimization

### Frontend Optimization
- ✅ Code splitting dengan React.lazy()
- ✅ Image optimization
- ✅ Bundle size monitoring
- ✅ CDN untuk static assets

### Backend Optimization
- ✅ Database query optimization
- ✅ Caching strategies
- ✅ API response compression
- ✅ Connection pooling

## 🔄 Backup & Recovery

### Database Backup
```sql
-- Supabase automatic backups
-- Manual backup via Supabase Dashboard
-- Export data as needed
```

### Code Backup
```bash
# GitHub serves as code backup
# Tag important releases
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0
```

## 📞 Support & Maintenance

### Regular Tasks
- 🔄 Monitor deployment status
- 📊 Check analytics dan performance
- 🔒 Update dependencies secara berkala
- 💾 Verify database backups
- 🔐 Rotate API keys secara berkala

### Emergency Procedures
- 🚨 Rollback ke previous deployment
- 🔧 Hotfix deployment process
- 📞 Contact support channels

---

## 🎯 Quick Deployment Checklist

- [ ] Repository pushed ke GitHub
- [ ] Vercel project created dan connected
- [ ] Environment variables configured
- [ ] Supabase database schema deployed
- [ ] First deployment successful
- [ ] API endpoints tested
- [ ] Frontend loading correctly
- [ ] WhatsApp integration tested
- [ ] Payment gateway tested
- [ ] Custom domain configured (optional)
- [ ] Monitoring setup

**🎉 Selamat! Platform Undian Digital Anda sudah live di production!**