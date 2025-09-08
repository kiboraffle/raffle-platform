const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware untuk verifikasi JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token akses diperlukan'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Cari user berdasarkan ID dari token
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid - pengguna tidak ditemukan'
      });
    }
    
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Akun tidak aktif'
      });
    }
    
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Akun terkunci karena terlalu banyak percobaan login yang gagal'
      });
    }
    
    // Tambahkan user ke request object
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token sudah kedaluwarsa'
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server internal'
    });
  }
};

// Middleware untuk verifikasi role admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autentikasi diperlukan'
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak - hanya admin yang diizinkan'
    });
  }
  
  next();
};

// Middleware untuk verifikasi user yang sudah terverifikasi
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autentikasi diperlukan'
    });
  }
  
  if (!req.user.is_verified) {
    return res.status(403).json({
      success: false,
      message: 'Akun belum terverifikasi - silakan verifikasi nomor WhatsApp Anda'
    });
  }
  
  next();
};

// Middleware untuk verifikasi optional (tidak wajib login)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (user && user.is_active && !user.isLocked) {
      req.user = user;
    } else {
      req.user = null;
    }
    
    next();
    
  } catch (error) {
    // Jika token tidak valid, lanjutkan tanpa user
    req.user = null;
    next();
  }
};

// Utility function untuk generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Utility function untuk verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Middleware untuk rate limiting per user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const userId = req.user ? req.user._id.toString() : req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Bersihkan request lama
    if (requests.has(userId)) {
      const userRequests = requests.get(userId).filter(time => time > windowStart);
      requests.set(userId, userRequests);
    }
    
    const userRequests = requests.get(userId) || [];
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Terlalu banyak permintaan, coba lagi nanti',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    userRequests.push(now);
    requests.set(userId, userRequests);
    
    next();
  };
};

// Middleware untuk logging aktivitas user
const logUserActivity = (action) => {
  return async (req, res, next) => {
    if (req.user) {
      console.log(`User Activity: ${req.user.id} - ${action} - ${new Date().toISOString()}`);
      
      // Update last login jika action adalah login
      if (action === 'login') {
        try {
          const user = await User.findById(req.user.id);
          if (user) {
            user.last_login = new Date().toISOString();
            await user.save();
          }
        } catch (err) {
          console.error('Error updating last login:', err);
        }
      }
    }
    
    next();
  };
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireVerified,
  optionalAuth,
  generateToken,
  verifyToken,
  userRateLimit,
  logUserActivity
};