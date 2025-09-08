const express = require('express');
const User = require('../models/User');
const { supabaseAdmin } = require('../config/supabase');
const { generateToken, authenticateToken } = require('../middleware/auth');
const {
  validateUserRegistration,
  validateLogin,
  validateOTPVerification,
  validatePasswordReset,
  validatePasswordChange
} = require('../middleware/validation');
const whatsappService = require('../utils/whatsapp');
const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', validateUserRegistration, async (req, res) => {
  try {
    const { whatsappNumber, password, fullName, email, dateOfBirth } = req.body;

    // Create new user (will check for existing user automatically)
    const user = await User.create({
      whatsappNumber,
      password,
      fullName,
      email,
      dateOfBirth
    });

    // Generate and send OTP
    const otpCode = user.generateOTP();
    await user.save();

    // Send OTP via WhatsApp
    const whatsappResult = await whatsappService.sendOTP(
      whatsappNumber,
      otpCode,
      fullName
    );

    if (!whatsappResult.success) {
      console.error('Failed to send OTP:', whatsappResult.error);
      // Don't fail registration if WhatsApp fails, user can request OTP again
    }

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil. Silakan verifikasi nomor WhatsApp Anda dengan kode OTP yang telah dikirim.',
      data: {
        userId: user.id,
        whatsappNumber: user.whatsapp_number,
        fullName: user.full_name,
        otpSent: whatsappResult.success
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat registrasi'
    });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and activate account
// @access  Public
router.post('/verify-otp', validateOTPVerification, async (req, res) => {
  try {
    const { whatsappNumber, otp } = req.body;

    // Find user
    const user = await User.findByWhatsApp(whatsappNumber);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    // Verify OTP
    if (!user.verifyOTP(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Kode OTP tidak valid atau sudah kedaluwarsa'
      });
    }

    // Activate user account
    user.is_verified = true;
    user.clearOTP();
    await user.save();

    // Generate JWT token
    const token = generateToken(user.id);

    // Send welcome message
    const welcomeResult = await whatsappService.sendRegistrationSuccess(
      whatsappNumber,
      user.fullName
    );

    if (!welcomeResult.success) {
      console.error('Failed to send welcome message:', welcomeResult.error);
    }

    res.json({
      success: true,
      message: 'Verifikasi berhasil. Akun Anda telah aktif.',
      data: {
        token,
        user: {
          id: user.id,
          whatsappNumber: user.whatsapp_number,
          fullName: user.full_name,
          email: user.email,
          isVerified: user.is_verified,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat verifikasi OTP'
    });
  }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP code
// @access  Public
router.post('/resend-otp', async (req, res) => {
  try {
    const { whatsappNumber } = req.body;

    if (!whatsappNumber) {
      return res.status(400).json({
        success: false,
        message: 'Nomor WhatsApp wajib diisi'
      });
    }

    // Find user
    const user = await User.findByWhatsApp(whatsappNumber);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    if (user.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'Akun sudah terverifikasi'
      });
    }

    // Generate new OTP
    const otpCode = user.generateOTP();
    await user.save();

    // Send OTP via WhatsApp
    const whatsappResult = await whatsappService.sendOTP(
      whatsappNumber,
      otpCode,
      user.fullName
    );

    res.json({
      success: true,
      message: 'Kode OTP baru telah dikirim ke nomor WhatsApp Anda.',
      data: {
        otpSent: whatsappResult.success
      }
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengirim ulang OTP'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { whatsappNumber, password } = req.body;

    // Find user
    const user = await User.findByWhatsApp(whatsappNumber);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Nomor WhatsApp atau password tidak valid'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Akun terkunci karena terlalu banyak percobaan login yang gagal. Coba lagi nanti.'
      });
    }

    // Check if account is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Akun tidak aktif. Hubungi administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Nomor WhatsApp atau password tidak valid'
      });
    }

    // Check if user is verified
    if (!user.is_verified) {
      // Generate new OTP for unverified users
      const otpCode = user.generateOTP();
      await user.save();

      // Send OTP
      const whatsappResult = await whatsappService.sendOTP(
        whatsappNumber,
        otpCode,
        user.fullName
      );

      return res.status(403).json({
        success: false,
        message: 'Akun belum terverifikasi. Kode OTP telah dikirim ke nomor WhatsApp Anda.',
        requiresVerification: true,
        data: {
          userId: user.id,
        whatsappNumber: user.whatsapp_number,
          otpSent: whatsappResult.success
        }
      });
    }

    // Reset login attempts on successful login
    if (user.login_attempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.last_login = new Date().toISOString();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        token,
        user: {
          id: user.id,
          whatsappNumber: user.whatsapp_number,
          fullName: user.full_name,
          email: user.email,
          isVerified: user.is_verified,
          role: user.role,
          lastLogin: user.last_login
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat login'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset link
// @access  Public
router.post('/forgot-password', validatePasswordReset, async (req, res) => {
  try {
    const { whatsappNumber } = req.body;

    // Find user
    const user = await User.findByWhatsApp(whatsappNumber);
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        success: true,
        message: 'Jika nomor WhatsApp terdaftar, link reset password telah dikirim.'
      });
    }

    // Generate reset token
    const resetToken = generateToken(user.id);
    user.reset_password_token = resetToken;
    user.reset_password_expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    await user.save();

    // Send reset link via WhatsApp
    const whatsappResult = await whatsappService.sendPasswordResetNotification(
      whatsappNumber,
      user.fullName,
      resetToken
    );

    res.json({
      success: true,
      message: 'Jika nomor WhatsApp terdaftar, link reset password telah dikirim.',
      data: {
        resetLinkSent: whatsappResult.success
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memproses permintaan reset password'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token dan password baru wajib diisi'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password baru minimal 6 karakter'
      });
    }

    // Find user with valid reset token
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('reset_password_token', token)
      .gt('reset_password_expires', new Date().toISOString());
    
    if (error) throw error;
    const user = users && users.length > 0 ? new User(users[0]) : null;

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token reset password tidak valid atau sudah kedaluwarsa'
      });
    }

    // Update password
    await user.updatePassword(newPassword);
    user.reset_password_token = null;
    user.reset_password_expires = null;
    
    // Reset login attempts if any
    if (user.login_attempts > 0) {
      await user.resetLoginAttempts();
    }
    
    await user.save();

    res.json({
      success: true,
      message: 'Password berhasil direset. Silakan login dengan password baru Anda.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat reset password'
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change password for authenticated user
// @access  Private
router.post('/change-password', authenticateToken, validatePasswordChange, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get user with password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password saat ini tidak valid'
      });
    }

    // Update password
    await user.updatePassword(newPassword);

    res.json({
      success: true,
      message: 'Password berhasil diubah'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengubah password'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          whatsappNumber: user.whatsapp_number,
          fullName: user.full_name,
          email: user.email,
          dateOfBirth: user.date_of_birth,
          address: user.address,
          isVerified: user.is_verified,
          isActive: user.is_active,
          role: user.role,
          profilePicture: user.profile_picture,
          lastLogin: user.last_login,
          totalTicketsPurchased: user.total_tickets_purchased,
          totalAmountSpent: user.total_amount_spent,
          totalWins: user.total_wins,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil profil pengguna'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // But we can log the logout event
    console.log(`User ${req.user.id} logged out at ${new Date()}`);
    
    res.json({
      success: true,
      message: 'Logout berhasil'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat logout'
    });
  }
});

// @route   GET /api/auth/check-phone
// @desc    Check if phone number is already registered
// @access  Public
router.get('/check-phone/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    const user = await User.findByWhatsApp(phoneNumber);
    
    res.json({
      success: true,
      data: {
        exists: !!user,
        isVerified: user ? user.isVerified : false
      }
    });
  } catch (error) {
    console.error('Check phone error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memeriksa nomor telepon'
    });
  }
});

module.exports = router;