const { body, param, query, validationResult } = require('express-validator');

// Middleware untuk menangani hasil validasi
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Data tidak valid',
      errors: errorMessages
    });
  }
  
  next();
};

// Validasi untuk registrasi user
const validateUserRegistration = [
  body('whatsappNumber')
    .notEmpty()
    .withMessage('Nomor WhatsApp wajib diisi')
    .matches(/^(\+62|62|0)8[1-9][0-9]{6,9}$/)
    .withMessage('Format nomor WhatsApp tidak valid (contoh: 08123456789)'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password minimal 6 karakter')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password harus mengandung huruf kecil, huruf besar, dan angka'),
  
  body('fullName')
    .notEmpty()
    .withMessage('Nama lengkap wajib diisi')
    .isLength({ min: 2, max: 100 })
    .withMessage('Nama lengkap harus 2-100 karakter')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Nama lengkap hanya boleh mengandung huruf dan spasi'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Format email tidak valid')
    .normalizeEmail(),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Format tanggal lahir tidak valid')
    .custom((value) => {
      const age = (new Date() - new Date(value)) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 17) {
        throw new Error('Usia minimal 17 tahun');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validasi untuk login
const validateLogin = [
  body('whatsappNumber')
    .notEmpty()
    .withMessage('Nomor WhatsApp wajib diisi'),
  
  body('password')
    .notEmpty()
    .withMessage('Password wajib diisi'),
  
  handleValidationErrors
];

// Validasi untuk verifikasi OTP
const validateOTPVerification = [
  body('whatsappNumber')
    .notEmpty()
    .withMessage('Nomor WhatsApp wajib diisi'),
  
  body('otp')
    .notEmpty()
    .withMessage('Kode OTP wajib diisi')
    .isLength({ min: 6, max: 6 })
    .withMessage('Kode OTP harus 6 digit')
    .isNumeric()
    .withMessage('Kode OTP harus berupa angka'),
  
  handleValidationErrors
];

// Validasi untuk membuat undian
const validateRaffleCreation = [
  body('title')
    .notEmpty()
    .withMessage('Judul undian wajib diisi')
    .isLength({ min: 5, max: 200 })
    .withMessage('Judul undian harus 5-200 karakter'),
  
  body('description')
    .notEmpty()
    .withMessage('Deskripsi undian wajib diisi')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Deskripsi undian harus 10-2000 karakter'),
  
  body('ticketPrice')
    .isNumeric()
    .withMessage('Harga tiket harus berupa angka')
    .custom((value) => {
      if (value < 1000 || value > 10000000) {
        throw new Error('Harga tiket harus antara Rp 1.000 - Rp 10.000.000');
      }
      return true;
    }),
  
  body('maxTickets')
    .isInt({ min: 10, max: 100000 })
    .withMessage('Jumlah maksimal tiket harus antara 10-100.000'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Format tanggal mulai tidak valid')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Tanggal mulai harus di masa depan');
      }
      return true;
    }),
  
  body('endDate')
    .isISO8601()
    .withMessage('Format tanggal berakhir tidak valid')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('Tanggal berakhir harus setelah tanggal mulai');
      }
      return true;
    }),
  
  body('drawDate')
    .isISO8601()
    .withMessage('Format tanggal pengundian tidak valid')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.endDate)) {
        throw new Error('Tanggal pengundian harus setelah atau sama dengan tanggal berakhir');
      }
      return true;
    }),
  
  body('terms')
    .notEmpty()
    .withMessage('Syarat dan ketentuan wajib diisi')
    .isLength({ max: 5000 })
    .withMessage('Syarat dan ketentuan maksimal 5000 karakter'),
  
  body('category')
    .optional()
    .isIn(['electronics', 'automotive', 'fashion', 'home', 'travel', 'cash', 'other'])
    .withMessage('Kategori tidak valid'),
  
  handleValidationErrors
];

// Validasi untuk membuat hadiah
const validatePrizeCreation = [
  body('name')
    .notEmpty()
    .withMessage('Nama hadiah wajib diisi')
    .isLength({ min: 2, max: 200 })
    .withMessage('Nama hadiah harus 2-200 karakter'),
  
  body('description')
    .notEmpty()
    .withMessage('Deskripsi hadiah wajib diisi')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Deskripsi hadiah harus 10-1000 karakter'),
  
  body('value')
    .isNumeric()
    .withMessage('Nilai hadiah harus berupa angka')
    .custom((value) => {
      if (value < 0) {
        throw new Error('Nilai hadiah tidak boleh negatif');
      }
      return true;
    }),
  
  body('quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Jumlah hadiah harus antara 1-100'),
  
  body('position')
    .isInt({ min: 1 })
    .withMessage('Posisi hadiah harus berupa bilangan bulat positif'),
  
  body('claimInstructions')
    .notEmpty()
    .withMessage('Instruksi klaim hadiah wajib diisi')
    .isLength({ max: 2000 })
    .withMessage('Instruksi klaim maksimal 2000 karakter'),
  
  body('claimDeadline')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Batas waktu klaim harus antara 1-365 hari'),
  
  body('category')
    .optional()
    .isIn(['electronics', 'automotive', 'fashion', 'home', 'travel', 'cash', 'voucher', 'other'])
    .withMessage('Kategori hadiah tidak valid'),
  
  handleValidationErrors
];

// Validasi untuk pembelian tiket
const validateTicketPurchase = [
  body('raffleId')
    .notEmpty()
    .withMessage('ID undian wajib diisi')
    .isMongoId()
    .withMessage('Format ID undian tidak valid'),
  
  body('quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Jumlah tiket harus antara 1-100'),
  
  body('paymentMethod')
    .notEmpty()
    .withMessage('Metode pembayaran wajib diisi')
    .isIn([
      'bank_transfer', 'virtual_account', 'credit_card', 'debit_card',
      'gopay', 'ovo', 'dana', 'shopeepay', 'linkaja', 'qris',
      'indomaret', 'alfamart'
    ])
    .withMessage('Metode pembayaran tidak valid'),
  
  handleValidationErrors
];

// Validasi untuk parameter ID MongoDB
const validateMongoId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Format ${paramName} tidak valid`),
  
  handleValidationErrors
];

// Validasi untuk query pagination
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Halaman harus berupa angka positif'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit harus antara 1-100'),
  
  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'title', '-title', 'price', '-price'])
    .withMessage('Parameter sort tidak valid'),
  
  handleValidationErrors
];

// Validasi untuk update profil user
const validateProfileUpdate = [
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nama lengkap harus 2-100 karakter')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Nama lengkap hanya boleh mengandung huruf dan spasi'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Format email tidak valid')
    .normalizeEmail(),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Format tanggal lahir tidak valid')
    .custom((value) => {
      const age = (new Date() - new Date(value)) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 17) {
        throw new Error('Usia minimal 17 tahun');
      }
      return true;
    }),
  
  body('address.street')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Alamat jalan maksimal 200 karakter'),
  
  body('address.city')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Nama kota maksimal 100 karakter'),
  
  body('address.province')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Nama provinsi maksimal 100 karakter'),
  
  body('address.postalCode')
    .optional()
    .matches(/^[0-9]{5}$/)
    .withMessage('Kode pos harus 5 digit angka'),
  
  handleValidationErrors
];

// Validasi untuk reset password
const validatePasswordReset = [
  body('whatsappNumber')
    .notEmpty()
    .withMessage('Nomor WhatsApp wajib diisi'),
  
  handleValidationErrors
];

// Validasi untuk change password
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Password saat ini wajib diisi'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password baru minimal 6 karakter')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password baru harus mengandung huruf kecil, huruf besar, dan angka'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Konfirmasi password tidak cocok');
      }
      return true;
    }),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateLogin,
  validateOTPVerification,
  validateRaffleCreation,
  validatePrizeCreation,
  validateTicketPurchase,
  validateMongoId,
  validatePagination,
  validateProfileUpdate,
  validatePasswordReset,
  validatePasswordChange
};