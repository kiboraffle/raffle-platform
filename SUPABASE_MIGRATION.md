# 🔄 Migrasi dari MongoDB ke Supabase

Panduan lengkap untuk migrasi Platform Undian Digital dari MongoDB ke Supabase PostgreSQL.

## ✅ Perubahan yang Sudah Dilakukan

### 1. Dependencies
- ✅ Menghapus `mongoose` dari package.json
- ✅ Menambahkan `@supabase/supabase-js` ke dependencies
- ✅ Mengupdate package.json dengan dependencies Supabase

### 2. Konfigurasi Database
- ✅ Membuat file `config/supabase.js` untuk koneksi Supabase
- ✅ Mengupdate `.env.example` dengan variabel Supabase
- ✅ Mengupdate `server.js` untuk menggunakan Supabase connection

### 3. Database Schema
- ✅ Membuat file `supabase-schema.sql` dengan schema PostgreSQL lengkap
- ✅ Termasuk semua tabel: users, raffles, prizes, tickets, payments
- ✅ Menambahkan indexes untuk performa optimal
- ✅ Mengimplementasikan Row Level Security (RLS)
- ✅ Membuat triggers untuk updated_at timestamps

### 4. Models
- ✅ Mengkonversi `models/User.js` dari Mongoose ke Supabase
- ✅ Mengupdate `models/index.js` untuk sementara hanya export User
- ⏳ **TODO:** Konversi models lainnya (Raffle, Prize, Ticket, Payment)

### 5. Routes
- ✅ Mengupdate `routes/auth.js` untuk menggunakan User model Supabase
- ✅ Menyesuaikan field names dari camelCase ke snake_case
- ⏳ **TODO:** Update routes lainnya (users, raffles, tickets, payments, admin, whatsapp)

### 6. Middleware
- ✅ Mengupdate `middleware/auth.js` untuk Supabase User model
- ✅ Menyesuaikan field names dan async operations

## 🚀 Langkah Selanjutnya

### 1. Setup Supabase Project

1. **Buat project baru di [Supabase](https://supabase.com)**
2. **Dapatkan credentials:**
   - Project URL
   - Anon Key
   - Service Role Key

3. **Update file `.env`:**
```env
# Database Configuration (Supabase)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Jalankan Database Schema

1. **Buka Supabase Dashboard → SQL Editor**
2. **Copy dan paste isi file `supabase-schema.sql`**
3. **Jalankan query untuk membuat semua tabel dan indexes**

### 3. Konversi Models yang Tersisa

Model yang perlu dikonversi:
- `models/Raffle.js`
- `models/Prize.js` 
- `models/Ticket.js`
- `models/Payment.js`

**Template konversi:**
```javascript
const { supabaseAdmin } = require('../config/supabase');

class ModelName {
  constructor(data) {
    Object.assign(this, data);
  }

  static async create(data) {
    const { data: result, error } = await supabaseAdmin
      .from('table_name')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return new ModelName(result);
  }

  static async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('table_name')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data ? new ModelName(data) : null;
  }

  async save() {
    const { data, error } = await supabaseAdmin
      .from('table_name')
      .update(this)
      .eq('id', this.id)
      .select()
      .single();
    
    if (error) throw error;
    Object.assign(this, data);
    return this;
  }
}

module.exports = ModelName;
```

### 4. Update Routes

Routes yang perlu diupdate:
- `routes/users.js`
- `routes/raffles.js`
- `routes/tickets.js`
- `routes/payments.js`
- `routes/admin.js`
- `routes/whatsapp.js`

**Perubahan utama:**
- Ganti import models
- Ubah field names dari camelCase ke snake_case
- Sesuaikan query methods

### 5. Update Utilities

Files yang perlu diupdate:
- `utils/raffle.js`
- `utils/payment.js`
- `utils/barcode.js`

### 6. Testing

1. **Test koneksi database:**
```bash
npm run dev
```

2. **Test endpoints satu per satu:**
   - POST /api/auth/register
   - POST /api/auth/login
   - GET /api/auth/me

3. **Test dengan Postman atau curl**

## 📋 Checklist Migrasi

### Database & Config
- [x] Setup Supabase project
- [x] Update environment variables
- [x] Create database schema
- [x] Update server.js connection

### Models
- [x] User model
- [ ] Raffle model
- [ ] Prize model
- [ ] Ticket model
- [ ] Payment model
- [ ] Update models/index.js

### Routes
- [x] auth.js
- [ ] users.js
- [ ] raffles.js
- [ ] tickets.js
- [ ] payments.js
- [ ] admin.js
- [ ] whatsapp.js

### Middleware
- [x] auth.js
- [ ] validation.js (if needed)

### Utilities
- [ ] raffle.js
- [ ] payment.js
- [ ] barcode.js
- [ ] whatsapp.js (if needed)

### Testing
- [ ] Database connection
- [ ] User registration
- [ ] User login
- [ ] User profile
- [ ] All other endpoints

## 🔧 Field Name Mapping

| MongoDB (camelCase) | Supabase (snake_case) |
|-------------------|---------------------|
| whatsappNumber | whatsapp_number |
| fullName | full_name |
| dateOfBirth | date_of_birth |
| isVerified | is_verified |
| isActive | is_active |
| profilePicture | profile_picture |
| lastLogin | last_login |
| loginAttempts | login_attempts |
| lockUntil | lock_until |
| resetPasswordToken | reset_password_token |
| resetPasswordExpires | reset_password_expires |
| otpCode | otp_code |
| otpExpires | otp_expires |
| totalTicketsPurchased | total_tickets_purchased |
| totalAmountSpent | total_amount_spent |
| totalWins | total_wins |
| createdAt | created_at |
| updatedAt | updated_at |

## ⚠️ Catatan Penting

1. **Backup Data:** Pastikan backup data MongoDB sebelum migrasi
2. **Environment:** Test di development environment dulu
3. **Field Names:** Konsisten gunakan snake_case untuk PostgreSQL
4. **Error Handling:** Supabase error codes berbeda dengan MongoDB
5. **Indexes:** Pastikan semua indexes sudah dibuat untuk performa
6. **RLS:** Row Level Security sudah dikonfigurasi untuk keamanan

## 🆘 Troubleshooting

### Error: Missing Supabase environment variables
**Solusi:** Pastikan semua variabel environment Supabase sudah diset di `.env`

### Error: relation "table_name" does not exist
**Solusi:** Jalankan `supabase-schema.sql` di Supabase SQL Editor

### Error: column "field_name" does not exist
**Solusi:** Periksa field name mapping, gunakan snake_case

### Error: PGRST116 (No rows found)
**Solusi:** Ini normal untuk findById yang tidak menemukan data, handle dengan proper error checking

## 📞 Support

Jika mengalami kesulitan dalam migrasi, silakan:
1. Periksa dokumentasi Supabase
2. Review error logs dengan teliti
3. Test setiap komponen secara bertahap
4. Gunakan Supabase Dashboard untuk debug database issues