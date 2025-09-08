# Platform Undian Digital Komersial

Platform undian digital yang aman, transparan, dan berfokus pada pengalaman pengguna mobile di Indonesia. Sistem ini dilengkapi dengan tiket barcode unik, notifikasi WhatsApp, dan integrasi payment gateway.

## 🚀 Fitur Utama

### 🔐 Autentikasi & Verifikasi
- Registrasi dengan nomor WhatsApp
- Verifikasi OTP melalui WhatsApp API
- Login dengan nomor WhatsApp dan password
- Reset password via WhatsApp
- Profil pengguna lengkap

### 🎯 Manajemen Undian
- Admin dapat membuat undian dengan multiple hadiah (3-5 hadiah)
- Setiap hadiah memiliki deskripsi, gambar, dan kuantitas
- Sistem penjadwalan undian otomatis
- Status undian real-time

### 🎫 Sistem Tiket & Barcode
- Tiket digital dengan barcode/QR code unik
- Setiap barcode mengarah ke halaman verifikasi
- Tracking tiket di profil pengguna
- Sistem klaim hadiah dengan barcode

### 💳 Payment Gateway
- Integrasi dengan Midtrans
- Support multiple payment methods:
  - Transfer Bank & Virtual Account
  - E-wallet (GoPay, OVO, DANA, ShopeePay)
  - Kartu Kredit/Debit
  - QRIS
  - Convenience Store (Indomaret, Alfamart)

### 🎲 Sistem Pengundian Transparan
- Algoritma pengacakan cryptographically secure
- Multiple pemenang sesuai jumlah hadiah
- Audit trail lengkap untuk setiap pengundian
- Verifikasi integritas hasil undian

### 📱 Notifikasi WhatsApp
- OTP verifikasi
- Konfirmasi pembelian tiket
- Pengingat undian akan berakhir
- Pengumuman pemenang
- Notifikasi undian baru

### 👨‍💼 Panel Admin
- Dashboard statistik lengkap
- Manajemen undian dan hadiah
- Manajemen pengguna
- Proses pengundian
- Verifikasi pemenang

## 🛠️ Teknologi

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing

### Integrasi
- **WhatsApp Business API** - Notifikasi dan OTP
- **Midtrans** - Payment gateway
- **QRCode** - Generate barcode/QR code
- **Crypto** - Secure random generation

### Security
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate limiting** - API protection
- **Input validation** - Data sanitization

## 📋 Persyaratan Sistem

- Node.js >= 16.0.0
- MongoDB >= 4.4
- npm >= 8.0.0

## 🚀 Instalasi

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd raffle
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit file `.env` dan isi dengan konfigurasi yang sesuai:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/raffle_platform
   
   # JWT
   JWT_SECRET=your_super_secret_jwt_key
   
   # WhatsApp API
   WHATSAPP_API_TOKEN=your_whatsapp_api_token
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   
   # Midtrans
   MIDTRANS_SERVER_KEY=your_midtrans_server_key
   MIDTRANS_CLIENT_KEY=your_midtrans_client_key
   ```

4. **Jalankan aplikasi**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - Registrasi pengguna
- `POST /api/auth/verify-otp` - Verifikasi OTP
- `POST /api/auth/login` - Login pengguna
- `POST /api/auth/forgot-password` - Reset password

### Raffles
- `GET /api/raffles` - Daftar undian aktif
- `GET /api/raffles/:id` - Detail undian
- `POST /api/raffles` - Buat undian (admin)
- `PUT /api/raffles/:id` - Update undian (admin)

### Tickets
- `POST /api/tickets/purchase` - Beli tiket
- `GET /api/tickets/user/:userId` - Tiket pengguna
- `GET /api/tickets/verify/:barcode` - Verifikasi barcode

### Payments
- `POST /api/payments/create` - Buat pembayaran
- `POST /api/payments/notification` - Webhook Midtrans
- `GET /api/payments/status/:orderId` - Status pembayaran

### Admin
- `GET /api/admin/dashboard` - Dashboard statistik
- `POST /api/admin/draw/:raffleId` - Lakukan pengundian
- `GET /api/admin/audit/:raffleId` - Audit log pengundian

## 🔧 Konfigurasi

### WhatsApp API Setup
1. Daftar di WhatsApp Business API
2. Dapatkan Phone Number ID dan Access Token
3. Setup webhook URL untuk notifikasi
4. Verifikasi webhook dengan verify token

### Midtrans Setup
1. Daftar akun Midtrans
2. Dapatkan Server Key dan Client Key
3. Setup notification URL untuk webhook
4. Konfigurasi payment methods yang diinginkan

### MongoDB Setup
1. Install MongoDB atau gunakan MongoDB Atlas
2. Buat database baru
3. Setup connection string di environment variables

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📁 Struktur Project

```
raffle/
├── models/              # Database models
│   ├── User.js
│   ├── Raffle.js
│   ├── Prize.js
│   ├── Ticket.js
│   └── Payment.js
├── routes/              # API routes
│   ├── auth.js
│   ├── raffles.js
│   ├── tickets.js
│   ├── payments.js
│   └── admin.js
├── middleware/          # Custom middleware
│   ├── auth.js
│   └── validation.js
├── utils/               # Utility functions
│   ├── whatsapp.js
│   ├── payment.js
│   ├── barcode.js
│   └── raffle.js
├── uploads/             # File uploads
├── server.js            # Main server file
└── package.json
```

## 🔒 Keamanan

- Semua password di-hash menggunakan bcrypt
- JWT token untuk autentikasi
- Rate limiting untuk mencegah abuse
- Input validation dan sanitization
- HTTPS wajib untuk production
- Webhook signature verification

## 📱 Mobile-First Design

- Responsive design untuk semua device
- Touch-friendly interface
- Fast loading dengan optimasi gambar
- Progressive Web App (PWA) ready

## 🚀 Deployment

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Configure production database
- [ ] Setup SSL certificate
- [ ] Configure production payment gateway
- [ ] Setup production WhatsApp API
- [ ] Configure monitoring dan logging
- [ ] Setup backup strategy

### Environment Variables Production
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://production-server/raffle_platform
JWT_SECRET=super_secure_production_secret
MIDTRANS_IS_PRODUCTION=true
```

## 📞 Support

Untuk pertanyaan dan dukungan teknis, silakan hubungi tim development.

## 📄 License

MIT License - lihat file LICENSE untuk detail lengkap.

---

**Platform Undian Digital** - Solusi undian modern untuk Indonesia 🇮🇩