const express = require('express');
const multer = require('multer');
const path = require('path');
const { Raffle, Prize, Ticket } = require('../models');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const {
  validateRaffleCreation,
  validateMongoId,
  validatePagination
} = require('../middleware/validation');
const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/raffles/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'raffle-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar dan video yang diperbolehkan'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// @route   GET /api/raffles
// @desc    Get all active raffles
// @access  Public
router.get('/', optionalAuth, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      featured,
      status = 'active',
      sort = '-createdAt'
    } = req.query;

    // Build query
    const query = {
      isPublished: true
    };

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (featured === 'true') {
      query.isFeatured = true;
    }

    // Execute query with pagination
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sort,
      populate: [
        {
          path: 'createdBy',
          select: 'fullName'
        }
      ]
    };

    const raffles = await Raffle.find(query)
      .populate('createdBy', 'fullName')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Raffle.countDocuments(query);

    // Add prize count for each raffle
    const rafflesWithPrizes = await Promise.all(
      raffles.map(async (raffle) => {
        const prizeCount = await Prize.countDocuments({
          raffle: raffle._id,
          isActive: true
        });
        
        return {
          ...raffle.toObject(),
          prizeCount
        };
      })
    );

    res.json({
      success: true,
      data: {
        raffles: rafflesWithPrizes,
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
    console.error('Get raffles error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data undian'
    });
  }
});

// @route   GET /api/raffles/featured
// @desc    Get featured raffles
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const featuredRaffles = await Raffle.findFeatured();
    
    // Add prize count for each raffle
    const rafflesWithPrizes = await Promise.all(
      featuredRaffles.map(async (raffle) => {
        const prizeCount = await Prize.countDocuments({
          raffle: raffle._id,
          isActive: true
        });
        
        return {
          ...raffle.toObject(),
          prizeCount
        };
      })
    );

    res.json({
      success: true,
      data: {
        raffles: rafflesWithPrizes
      }
    });
  } catch (error) {
    console.error('Get featured raffles error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil undian unggulan'
    });
  }
});

// @route   GET /api/raffles/categories
// @desc    Get raffle categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { code: 'electronics', name: 'Elektronik', icon: '📱' },
      { code: 'automotive', name: 'Otomotif', icon: '🚗' },
      { code: 'fashion', name: 'Fashion', icon: '👕' },
      { code: 'home', name: 'Rumah Tangga', icon: '🏠' },
      { code: 'travel', name: 'Travel', icon: '✈️' },
      { code: 'cash', name: 'Uang Tunai', icon: '💰' },
      { code: 'other', name: 'Lainnya', icon: '🎁' }
    ];

    // Get count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Raffle.countDocuments({
          category: category.code,
          isPublished: true,
          status: 'active'
        });
        
        return {
          ...category,
          count
        };
      })
    );

    res.json({
      success: true,
      data: {
        categories: categoriesWithCount
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil kategori'
    });
  }
});

// @route   GET /api/raffles/:id
// @desc    Get single raffle by ID
// @access  Public
router.get('/:id', optionalAuth, validateMongoId('id'), async (req, res) => {
  try {
    const raffleId = req.params.id;

    const raffle = await Raffle.findById(raffleId)
      .populate('createdBy', 'fullName')
      .exec();

    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    // Check if raffle is published or user is admin
    if (!raffle.isPublished && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    // Get prizes for this raffle
    const prizes = await Prize.findByRaffle(raffleId);

    // Get ticket statistics
    const ticketStats = {
      totalSold: raffle.ticketsSold,
      remaining: raffle.remainingTickets,
      soldPercentage: raffle.soldPercentage
    };

    // Get user's tickets for this raffle (if authenticated)
    let userTickets = [];
    if (req.user) {
      userTickets = await Ticket.findUserTickets(req.user._id, {
        raffleId: raffleId
      });
    }

    res.json({
      success: true,
      data: {
        raffle: {
          ...raffle.toObject(),
          prizes,
          ticketStats,
          userTickets: userTickets.length,
          userTicketsList: req.user ? userTickets : undefined
        }
      }
    });
  } catch (error) {
    console.error('Get raffle error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data undian'
    });
  }
});

// @route   POST /api/raffles
// @desc    Create new raffle
// @access  Private (Admin only)
router.post('/', authenticateToken, requireAdmin, validateRaffleCreation, async (req, res) => {
  try {
    const raffleData = {
      ...req.body,
      createdBy: req.user._id
    };

    const raffle = new Raffle(raffleData);
    await raffle.save();

    const populatedRaffle = await Raffle.findById(raffle._id)
      .populate('createdBy', 'fullName');

    res.status(201).json({
      success: true,
      message: 'Undian berhasil dibuat',
      data: {
        raffle: populatedRaffle
      }
    });
  } catch (error) {
    console.error('Create raffle error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat undian'
    });
  }
});

// @route   PUT /api/raffles/:id
// @desc    Update raffle
// @access  Private (Admin only)
router.put('/:id', authenticateToken, requireAdmin, validateMongoId('id'), async (req, res) => {
  try {
    const raffleId = req.params.id;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.createdBy;
    delete updateData.ticketsSold;
    delete updateData.drawResults;

    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    // Check if raffle can be updated
    if (raffle.status === 'drawn') {
      return res.status(400).json({
        success: false,
        message: 'Undian yang sudah diundi tidak dapat diubah'
      });
    }

    const updatedRaffle = await Raffle.findByIdAndUpdate(
      raffleId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName');

    res.json({
      success: true,
      message: 'Undian berhasil diperbarui',
      data: {
        raffle: updatedRaffle
      }
    });
  } catch (error) {
    console.error('Update raffle error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memperbarui undian'
    });
  }
});

// @route   POST /api/raffles/:id/activate
// @desc    Activate raffle
// @access  Private (Admin only)
router.post('/:id/activate', authenticateToken, requireAdmin, validateMongoId('id'), async (req, res) => {
  try {
    const raffleId = req.params.id;

    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    // Check if raffle has prizes
    const prizeCount = await Prize.countDocuments({
      raffle: raffleId,
      isActive: true
    });

    if (prizeCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Undian harus memiliki minimal 1 hadiah sebelum dapat diaktifkan'
      });
    }

    await raffle.activate();

    res.json({
      success: true,
      message: 'Undian berhasil diaktifkan',
      data: {
        raffle
      }
    });
  } catch (error) {
    console.error('Activate raffle error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat mengaktifkan undian'
    });
  }
});

// @route   POST /api/raffles/:id/end
// @desc    End raffle
// @access  Private (Admin only)
router.post('/:id/end', authenticateToken, requireAdmin, validateMongoId('id'), async (req, res) => {
  try {
    const raffleId = req.params.id;

    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    await raffle.endRaffle();

    res.json({
      success: true,
      message: 'Undian berhasil diakhiri',
      data: {
        raffle
      }
    });
  } catch (error) {
    console.error('End raffle error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat mengakhiri undian'
    });
  }
});

// @route   POST /api/raffles/:id/cancel
// @desc    Cancel raffle
// @access  Private (Admin only)
router.post('/:id/cancel', authenticateToken, requireAdmin, validateMongoId('id'), async (req, res) => {
  try {
    const raffleId = req.params.id;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Alasan pembatalan wajib diisi'
      });
    }

    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    await raffle.cancelRaffle(reason);

    res.json({
      success: true,
      message: 'Undian berhasil dibatalkan',
      data: {
        raffle
      }
    });
  } catch (error) {
    console.error('Cancel raffle error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat membatalkan undian'
    });
  }
});

// @route   POST /api/raffles/:id/upload-image
// @desc    Upload raffle image
// @access  Private (Admin only)
router.post('/:id/upload-image', authenticateToken, requireAdmin, validateMongoId('id'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File gambar wajib diupload'
      });
    }

    const raffleId = req.params.id;
    const { type = 'featured' } = req.body; // featured, gallery, background
    const imagePath = `/uploads/raffles/${req.file.filename}`;

    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    let updateData = {};
    
    if (type === 'featured') {
      updateData.featuredImage = imagePath;
    } else if (type === 'gallery') {
      updateData.$push = { gallery: imagePath };
    } else if (type === 'background') {
      updateData.backgroundVideo = imagePath;
    }

    const updatedRaffle = await Raffle.findByIdAndUpdate(
      raffleId,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Gambar berhasil diupload',
      data: {
        imagePath,
        raffle: updatedRaffle
      }
    });
  } catch (error) {
    console.error('Upload raffle image error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengupload gambar'
    });
  }
});

// @route   GET /api/raffles/:id/participants
// @desc    Get raffle participants
// @access  Private (Admin only)
router.get('/:id/participants', authenticateToken, requireAdmin, validateMongoId('id'), validatePagination, async (req, res) => {
  try {
    const raffleId = req.params.id;
    const { page = 1, limit = 20 } = req.query;

    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    // Get unique participants
    const participants = await Ticket.aggregate([
      {
        $match: {
          raffle: raffle._id,
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$user',
          totalTickets: { $sum: '$quantity' },
          totalSpent: { $sum: '$totalAmount' },
          firstPurchase: { $min: '$purchaseDate' },
          lastPurchase: { $max: '$purchaseDate' },
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
      },
      {
        $project: {
          userId: '$_id',
          fullName: '$user.fullName',
          whatsappNumber: '$user.whatsappNumber',
          totalTickets: 1,
          totalSpent: 1,
          firstPurchase: 1,
          lastPurchase: 1,
          isWinner: 1
        }
      },
      {
        $sort: { totalTickets: -1, firstPurchase: 1 }
      }
    ]);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedParticipants = participants.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        participants: paginatedParticipants,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(participants.length / limit),
          totalItems: participants.length,
          itemsPerPage: parseInt(limit),
          hasNextPage: endIndex < participants.length,
          hasPrevPage: page > 1
        },
        summary: {
          totalParticipants: participants.length,
          totalTicketsSold: raffle.ticketsSold,
          totalRevenue: raffle.statistics.totalRevenue
        }
      }
    });
  } catch (error) {
    console.error('Get raffle participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data peserta'
    });
  }
});

// @route   DELETE /api/raffles/:id
// @desc    Delete raffle (soft delete)
// @access  Private (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateMongoId('id'), async (req, res) => {
  try {
    const raffleId = req.params.id;

    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    // Check if raffle has sold tickets
    if (raffle.ticketsSold > 0) {
      return res.status(400).json({
        success: false,
        message: 'Undian yang sudah memiliki tiket terjual tidak dapat dihapus'
      });
    }

    // Soft delete - just unpublish
    raffle.isPublished = false;
    raffle.status = 'cancelled';
    await raffle.save();

    res.json({
      success: true,
      message: 'Undian berhasil dihapus'
    });
  } catch (error) {
    console.error('Delete raffle error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghapus undian'
    });
  }
});

module.exports = router;