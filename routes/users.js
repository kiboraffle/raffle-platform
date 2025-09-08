const express = require('express');
const multer = require('multer');
const path = require('path');
const { User, Ticket, Payment } = require('../models');
const { authenticateToken, requireVerified } = require('../middleware/auth');
const { validateProfileUpdate, validatePagination } = require('../middleware/validation');
const router = express.Router();

// Configure multer for profile picture upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/profiles/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar yang diperbolehkan'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    // Get user statistics
    const stats = await Ticket.getUserStats(user._id);
    const userStats = stats.length > 0 ? stats[0] : {
      totalTickets: 0,
      totalSpent: 0,
      totalWins: 0,
      activeTickets: 0
    };

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          whatsappNumber: user.whatsappNumber,
          fullName: user.fullName,
          email: user.email,
          dateOfBirth: user.dateOfBirth,
          address: user.address,
          isVerified: user.isVerified,
          isActive: user.isActive,
          role: user.role,
          profilePicture: user.profilePicture,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          statistics: userStats
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil profil'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticateToken, validateProfileUpdate, async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;

    // Remove fields that shouldn't be updated via this endpoint
    delete updateData.whatsappNumber;
    delete updateData.password;
    delete updateData.isVerified;
    delete updateData.isActive;
    delete updateData.role;

    // Check if email is being updated and if it's already taken
    if (updateData.email) {
      const existingUser = await User.findOne({
        email: updateData.email,
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email sudah digunakan oleh pengguna lain'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    res.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      data: {
        user: {
          id: user._id,
          whatsappNumber: user.whatsappNumber,
          fullName: user.fullName,
          email: user.email,
          dateOfBirth: user.dateOfBirth,
          address: user.address,
          isVerified: user.isVerified,
          profilePicture: user.profilePicture
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memperbarui profil'
    });
  }
});

// @route   POST /api/users/profile/picture
// @desc    Upload profile picture
// @access  Private
router.post('/profile/picture', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File gambar wajib diupload'
      });
    }

    const userId = req.user._id;
    const profilePicturePath = `/uploads/profiles/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      userId,
      { profilePicture: profilePicturePath },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    res.json({
      success: true,
      message: 'Foto profil berhasil diupload',
      data: {
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengupload foto profil'
    });
  }
});

// @route   GET /api/users/tickets
// @desc    Get user's tickets
// @access  Private
router.get('/tickets', authenticateToken, requireVerified, validatePagination, async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      status,
      raffleId,
      isWinner
    } = req.query;

    const options = {
      status,
      raffleId,
      isWinner: isWinner !== undefined ? isWinner === 'true' : undefined
    };

    // Remove undefined values
    Object.keys(options).forEach(key => {
      if (options[key] === undefined) {
        delete options[key];
      }
    });

    const tickets = await Ticket.findUserTickets(userId, options);
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTickets = tickets.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        tickets: paginatedTickets,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(tickets.length / limit),
          totalItems: tickets.length,
          itemsPerPage: parseInt(limit),
          hasNextPage: endIndex < tickets.length,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get user tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data tiket'
    });
  }
});

// @route   GET /api/users/payments
// @desc    Get user's payment history
// @access  Private
router.get('/payments', authenticateToken, requireVerified, validatePagination, async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      status,
      raffleId
    } = req.query;

    const options = {
      status,
      raffleId
    };

    // Remove undefined values
    Object.keys(options).forEach(key => {
      if (options[key] === undefined) {
        delete options[key];
      }
    });

    const payments = await Payment.findUserPayments(userId, options);
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedPayments = payments.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        payments: paginatedPayments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(payments.length / limit),
          totalItems: payments.length,
          itemsPerPage: parseInt(limit),
          hasNextPage: endIndex < payments.length,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil riwayat pembayaran'
    });
  }
});

// @route   GET /api/users/wins
// @desc    Get user's winning tickets
// @access  Private
router.get('/wins', authenticateToken, requireVerified, validatePagination, async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const winningTickets = await Ticket.findUserTickets(userId, { isWinner: true });
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedWins = winningTickets.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        wins: paginatedWins,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(winningTickets.length / limit),
          totalItems: winningTickets.length,
          itemsPerPage: parseInt(limit),
          hasNextPage: endIndex < winningTickets.length,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get user wins error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data kemenangan'
    });
  }
});

// @route   GET /api/users/statistics
// @desc    Get user's detailed statistics
// @access  Private
router.get('/statistics', authenticateToken, requireVerified, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get basic stats
    const stats = await Ticket.getUserStats(userId);
    const userStats = stats.length > 0 ? stats[0] : {
      totalTickets: 0,
      totalSpent: 0,
      totalWins: 0,
      activeTickets: 0
    };

    // Get monthly spending
    const monthlySpending = await Payment.aggregate([
      {
        $match: {
          user: userId,
          status: 'paid',
          createdAt: {
            $gte: new Date(new Date().getFullYear(), 0, 1) // Start of current year
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get recent activity
    const recentTickets = await Ticket.find({
      user: userId
    })
    .populate('raffle', 'title featuredImage')
    .sort({ createdAt: -1 })
    .limit(5);

    // Calculate win rate
    const winRate = userStats.totalTickets > 0 
      ? (userStats.totalWins / userStats.totalTickets) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          ...userStats,
          winRate: Math.round(winRate * 100) / 100,
          averageSpendingPerTicket: userStats.totalTickets > 0 
            ? Math.round(userStats.totalSpent / userStats.totalTickets)
            : 0
        },
        monthlySpending,
        recentActivity: recentTickets
      }
    });
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil statistik pengguna'
    });
  }
});

// @route   DELETE /api/users/account
// @desc    Delete user account (soft delete)
// @access  Private
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { reason } = req.body;

    // Check if user has active tickets or pending payments
    const activeTickets = await Ticket.countDocuments({
      user: userId,
      status: 'active'
    });

    const pendingPayments = await Payment.countDocuments({
      user: userId,
      status: 'pending'
    });

    if (activeTickets > 0 || pendingPayments > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat menghapus akun karena masih memiliki tiket aktif atau pembayaran pending'
      });
    }

    // Soft delete - deactivate account
    const user = await User.findByIdAndUpdate(
      userId,
      {
        isActive: false,
        deletedAt: new Date(),
        deleteReason: reason || 'User requested account deletion'
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    res.json({
      success: true,
      message: 'Akun berhasil dihapus'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghapus akun'
    });
  }
});

// @route   GET /api/users/notifications
// @desc    Get user notification preferences
// @access  Private
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationPreferences');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    const defaultPreferences = {
      whatsappNotifications: true,
      emailNotifications: false,
      raffleReminders: true,
      winnerAnnouncements: true,
      newRaffleAlerts: true,
      paymentConfirmations: true
    };

    res.json({
      success: true,
      data: {
        preferences: user.notificationPreferences || defaultPreferences
      }
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil preferensi notifikasi'
    });
  }
});

// @route   PUT /api/users/notifications
// @desc    Update user notification preferences
// @access  Private
router.put('/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Preferensi notifikasi tidak valid'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { notificationPreferences: preferences },
      { new: true }
    ).select('notificationPreferences');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    res.json({
      success: true,
      message: 'Preferensi notifikasi berhasil diperbarui',
      data: {
        preferences: user.notificationPreferences
      }
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memperbarui preferensi notifikasi'
    });
  }
});

module.exports = router;