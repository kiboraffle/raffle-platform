const express = require('express');
const { Raffle, Prize, Ticket, Payment, User } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  validatePrizeCreation,
  validateMongoId,
  validatePagination
} = require('../middleware/validation');
const raffleDrawService = require('../utils/raffle');
const whatsappService = require('../utils/whatsapp');
const router = express.Router();

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get basic counts
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalRaffles = await Raffle.countDocuments();
    const activeRaffles = await Raffle.countDocuments({ status: 'active' });
    const totalTickets = await Ticket.countDocuments({ status: 'active' });

    // Get revenue statistics
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: { $gte: startOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Get user growth
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth },
      isActive: true
    });

    // Get payment statistics
    const paymentStats = await Payment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get recent activities
    const recentPayments = await Payment.find({ status: 'paid' })
      .populate('user', 'fullName whatsappNumber')
      .populate('raffle', 'title')
      .sort({ paidAt: -1 })
      .limit(10);

    const recentWinners = await Ticket.find({ isWinner: true })
      .populate('user', 'fullName whatsappNumber')
      .populate('raffle', 'title')
      .populate('prizeWon', 'name value')
      .sort({ wonAt: -1 })
      .limit(10);

    // Get raffle statistics
    const raffleStats = await Raffle.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get top selling raffles
    const topRaffles = await Raffle.find()
      .sort({ ticketsSold: -1 })
      .limit(5)
      .select('title ticketsSold maxTickets ticketPrice statistics.totalRevenue');

    // Monthly revenue chart data
    const monthlyRevenueChart = await Payment.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: { $gte: startOfYear }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$totalAmount' },
          transactions: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalRaffles,
          activeRaffles,
          totalTickets,
          totalRevenue: totalRevenue[0]?.total || 0,
          monthlyRevenue: monthlyRevenue[0]?.total || 0,
          newUsersThisMonth
        },
        paymentStats,
        raffleStats,
        topRaffles,
        recentActivities: {
          payments: recentPayments,
          winners: recentWinners
        },
        charts: {
          monthlyRevenue: monthlyRevenueChart
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data dashboard'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Private (Admin only)
router.get('/users', authenticateToken, requireAdmin, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      verified,
      sort = '-createdAt'
    } = req.query;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { whatsappNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.isActive = status === 'active';
    }
    
    if (verified !== undefined) {
      query.isVerified = verified === 'true';
    }

    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await User.countDocuments(query);

    // Add user statistics
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const stats = await Ticket.getUserStats(user._id);
        const userStats = stats.length > 0 ? stats[0] : {
          totalTickets: 0,
          totalSpent: 0,
          totalWins: 0,
          activeTickets: 0
        };
        
        return {
          ...user.toObject(),
          statistics: userStats
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data pengguna'
    });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status
// @access  Private (Admin only)
router.put('/users/:id/status', authenticateToken, requireAdmin, validateMongoId('id'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { isActive, reason } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Status aktif harus berupa boolean'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isActive,
        ...(reason && { statusChangeReason: reason }),
        statusChangedAt: new Date(),
        statusChangedBy: req.user._id
      },
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
      message: `Status pengguna berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'}`,
      data: { user }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengubah status pengguna'
    });
  }
});

// @route   POST /api/admin/prizes
// @desc    Create new prize for a raffle
// @access  Private (Admin only)
router.post('/prizes', authenticateToken, requireAdmin, validatePrizeCreation, async (req, res) => {
  try {
    const prizeData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Check if raffle exists
    const raffle = await Raffle.findById(prizeData.raffle);
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    // Check if position is already taken
    const existingPrize = await Prize.findOne({
      raffle: prizeData.raffle,
      position: prizeData.position,
      isActive: true
    });

    if (existingPrize) {
      return res.status(400).json({
        success: false,
        message: `Posisi ${prizeData.position} sudah digunakan`
      });
    }

    const prize = new Prize(prizeData);
    await prize.save();

    const populatedPrize = await Prize.findById(prize._id)
      .populate('raffle', 'title')
      .populate('createdBy', 'fullName');

    res.status(201).json({
      success: true,
      message: 'Hadiah berhasil dibuat',
      data: { prize: populatedPrize }
    });
  } catch (error) {
    console.error('Create prize error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat hadiah'
    });
  }
});

// @route   PUT /api/admin/prizes/:id
// @desc    Update prize
// @access  Private (Admin only)
router.put('/prizes/:id', authenticateToken, requireAdmin, validateMongoId('id'), async (req, res) => {
  try {
    const prizeId = req.params.id;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.createdBy;
    delete updateData.winners;

    const prize = await Prize.findById(prizeId);
    if (!prize) {
      return res.status(404).json({
        success: false,
        message: 'Hadiah tidak ditemukan'
      });
    }

    // Check if raffle is already drawn
    const raffle = await Raffle.findById(prize.raffle);
    if (raffle && raffle.drawResults.isDrawn) {
      return res.status(400).json({
        success: false,
        message: 'Hadiah dari undian yang sudah diundi tidak dapat diubah'
      });
    }

    // Check position conflict if position is being updated
    if (updateData.position && updateData.position !== prize.position) {
      const existingPrize = await Prize.findOne({
        raffle: prize.raffle,
        position: updateData.position,
        isActive: true,
        _id: { $ne: prizeId }
      });

      if (existingPrize) {
        return res.status(400).json({
          success: false,
          message: `Posisi ${updateData.position} sudah digunakan`
        });
      }
    }

    const updatedPrize = await Prize.findByIdAndUpdate(
      prizeId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('raffle', 'title')
    .populate('createdBy', 'fullName');

    res.json({
      success: true,
      message: 'Hadiah berhasil diperbarui',
      data: { prize: updatedPrize }
    });
  } catch (error) {
    console.error('Update prize error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memperbarui hadiah'
    });
  }
});

// @route   DELETE /api/admin/prizes/:id
// @desc    Delete prize
// @access  Private (Admin only)
router.delete('/prizes/:id', authenticateToken, requireAdmin, validateMongoId('id'), async (req, res) => {
  try {
    const prizeId = req.params.id;

    const prize = await Prize.findById(prizeId);
    if (!prize) {
      return res.status(404).json({
        success: false,
        message: 'Hadiah tidak ditemukan'
      });
    }

    // Check if raffle is already drawn
    const raffle = await Raffle.findById(prize.raffle);
    if (raffle && raffle.drawResults.isDrawn) {
      return res.status(400).json({
        success: false,
        message: 'Hadiah dari undian yang sudah diundi tidak dapat dihapus'
      });
    }

    // Check if prize has winners
    if (prize.winners && prize.winners.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Hadiah yang sudah memiliki pemenang tidak dapat dihapus'
      });
    }

    // Soft delete
    prize.isActive = false;
    await prize.save();

    res.json({
      success: true,
      message: 'Hadiah berhasil dihapus'
    });
  } catch (error) {
    console.error('Delete prize error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghapus hadiah'
    });
  }
});

// @route   POST /api/admin/draw/:raffleId
// @desc    Perform raffle draw
// @access  Private (Admin only)
router.post('/draw/:raffleId', authenticateToken, requireAdmin, validateMongoId('raffleId'), async (req, res) => {
  try {
    const raffleId = req.params.raffleId;
    const drawnBy = req.user._id;

    // Perform the draw
    const drawResult = await raffleDrawService.performDraw(raffleId, drawnBy);

    if (!drawResult.success) {
      return res.status(400).json({
        success: false,
        message: drawResult.error
      });
    }

    // Send notifications to winners and non-winners
    const raffle = await Raffle.findById(raffleId);
    
    // Get all participants
    const allParticipants = await Ticket.aggregate([
      {
        $match: {
          raffle: raffle._id,
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$user',
          isWinner: { $max: '$isWinner' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      }
    ]);

    // Send notifications
    for (const participant of allParticipants) {
      try {
        if (participant.isWinner) {
          // Find winner's prize
          const winnerTicket = await Ticket.findOne({
            user: participant._id,
            raffle: raffleId,
            isWinner: true
          }).populate('prizeWon', 'name value claimInstructions');

          if (winnerTicket && winnerTicket.prizeWon) {
            await whatsappService.sendWinnerAnnouncement(
              participant.user.whatsappNumber,
              participant.user.fullName,
              raffle.title,
              winnerTicket.prizeWon.name,
              winnerTicket.prizeWon.value,
              winnerTicket.prizeWon.claimInstructions
            );
          }
        } else {
          await whatsappService.sendNotWinnerNotification(
            participant.user.whatsappNumber,
            participant.user.fullName,
            raffle.title
          );
        }
        
        // Add delay between notifications
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error sending notification to ${participant.user.whatsappNumber}:`, error);
      }
    }

    // Update raffle notification status
    raffle.notifications.resultsSent = true;
    await raffle.save();

    res.json({
      success: true,
      message: 'Pengundian berhasil dilakukan',
      data: {
        drawId: drawResult.drawId,
        totalWinners: drawResult.totalWinners,
        totalTickets: drawResult.totalTickets,
        totalPrizes: drawResult.totalPrizes,
        drawnAt: drawResult.drawnAt,
        winners: drawResult.winners
      }
    });
  } catch (error) {
    console.error('Perform draw error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat melakukan pengundian'
    });
  }
});

// @route   GET /api/admin/audit/:raffleId
// @desc    Get raffle draw audit log
// @access  Private (Admin only)
router.get('/audit/:raffleId', authenticateToken, requireAdmin, validateMongoId('raffleId'), async (req, res) => {
  try {
    const raffleId = req.params.raffleId;

    const auditResult = await raffleDrawService.getDrawAuditLog(raffleId);

    if (!auditResult.success) {
      return res.status(404).json({
        success: false,
        message: auditResult.error
      });
    }

    // Get draw integrity verification
    const verificationResult = await raffleDrawService.verifyDrawIntegrity(raffleId);
    
    res.json({
      success: true,
      data: {
        auditLog: auditResult.auditLog,
        verification: verificationResult.success ? verificationResult.verification : null
      }
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil log audit'
    });
  }
});

// @route   GET /api/admin/statistics/:raffleId
// @desc    Get raffle statistics
// @access  Private (Admin only)
router.get('/statistics/:raffleId', authenticateToken, requireAdmin, validateMongoId('raffleId'), async (req, res) => {
  try {
    const raffleId = req.params.raffleId;

    const statsResult = await raffleDrawService.getDrawStatistics(raffleId);

    if (!statsResult.success) {
      return res.status(404).json({
        success: false,
        message: statsResult.error
      });
    }

    res.json({
      success: true,
      data: {
        statistics: statsResult.statistics
      }
    });
  } catch (error) {
    console.error('Get raffle statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil statistik undian'
    });
  }
});

// @route   GET /api/admin/payments
// @desc    Get all payments with filters
// @access  Private (Admin only)
router.get('/payments', authenticateToken, requireAdmin, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentMethod,
      startDate,
      endDate,
      search,
      sort = '-createdAt'
    } = req.query;

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (search) {
      query.$or = [
        { paymentId: { $regex: search, $options: 'i' } },
        { gatewayTransactionId: { $regex: search, $options: 'i' } }
      ];
    }

    const payments = await Payment.find(query)
      .populate('user', 'fullName whatsappNumber')
      .populate('raffle', 'title')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data pembayaran'
    });
  }
});

// @route   GET /api/admin/reports/revenue
// @desc    Get revenue report
// @access  Private (Admin only)
router.get('/reports/revenue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const matchStage = {
      status: 'paid'
    };
    
    if (startDate || endDate) {
      matchStage.paidAt = {};
      if (startDate) matchStage.paidAt.$gte = new Date(startDate);
      if (endDate) matchStage.paidAt.$lte = new Date(endDate);
    }
    
    let groupStage;
    switch (groupBy) {
      case 'hour':
        groupStage = {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' },
            day: { $dayOfMonth: '$paidAt' },
            hour: { $hour: '$paidAt' }
          }
        };
        break;
      case 'day':
        groupStage = {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' },
            day: { $dayOfMonth: '$paidAt' }
          }
        };
        break;
      case 'month':
        groupStage = {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' }
          }
        };
        break;
      case 'year':
        groupStage = {
          _id: {
            year: { $year: '$paidAt' }
          }
        };
        break;
      default:
        groupStage = {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' },
            day: { $dayOfMonth: '$paidAt' }
          }
        };
    }
    
    groupStage.revenue = { $sum: '$totalAmount' };
    groupStage.transactions = { $sum: 1 };
    groupStage.avgTransaction = { $avg: '$totalAmount' };
    
    const revenueData = await Payment.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { '_id': 1 } }
    ]);
    
    // Get payment method breakdown
    const paymentMethodBreakdown = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$paymentMethod',
          revenue: { $sum: '$totalAmount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        revenueData,
        paymentMethodBreakdown,
        summary: {
          totalRevenue: revenueData.reduce((sum, item) => sum + item.revenue, 0),
          totalTransactions: revenueData.reduce((sum, item) => sum + item.transactions, 0),
          avgTransactionValue: revenueData.length > 0 
            ? revenueData.reduce((sum, item) => sum + item.avgTransaction, 0) / revenueData.length 
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Get revenue report error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil laporan pendapatan'
    });
  }
});

module.exports = router;