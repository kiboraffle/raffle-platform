const express = require('express');
const { Ticket, Raffle, Payment, User } = require('../models');
const { authenticateToken, requireVerified, optionalAuth } = require('../middleware/auth');
const {
  validateTicketPurchase,
  validateMongoId,
  validatePagination
} = require('../middleware/validation');
const barcodeService = require('../utils/barcode');
const paymentService = require('../utils/payment');
const whatsappService = require('../utils/whatsapp');
const router = express.Router();

// @route   POST /api/tickets/purchase
// @desc    Purchase tickets for a raffle
// @access  Private (Verified users only)
router.post('/purchase', authenticateToken, requireVerified, validateTicketPurchase, async (req, res) => {
  try {
    const { raffleId, quantity, paymentMethod } = req.body;
    const userId = req.user._id;

    // Get raffle details
    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Undian tidak ditemukan'
      });
    }

    // Check if raffle is active and can accept purchases
    if (!raffle.canPurchase) {
      return res.status(400).json({
        success: false,
        message: 'Undian tidak tersedia untuk pembelian tiket'
      });
    }

    // Check if enough tickets are available
    if (quantity > raffle.remainingTickets) {
      return res.status(400).json({
        success: false,
        message: `Hanya tersisa ${raffle.remainingTickets} tiket`
      });
    }

    // Calculate amounts
    const ticketPrice = raffle.ticketPrice;
    const subtotal = ticketPrice * quantity;
    const adminFee = paymentService.calculateAdminFee(subtotal, paymentMethod);
    const totalAmount = subtotal + adminFee;

    // Create payment record
    const payment = new Payment({
      user: userId,
      raffle: raffleId,
      amount: subtotal,
      ticketQuantity: quantity,
      ticketPrice: ticketPrice,
      adminFee: adminFee,
      totalAmount: totalAmount,
      paymentMethod: paymentMethod,
      paymentChannel: paymentMethod,
      gatewayProvider: 'midtrans',
      customerInfo: {
        name: req.user.fullName,
        email: req.user.email || `${req.user.whatsappNumber}@raffle.com`,
        phone: req.user.whatsappNumber
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        source: 'web'
      }
    });

    await payment.save();

    // Create tickets (initially with pending status)
    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      const ticketData = {
        ticketId: null, // Will be set after ticket creation
        userId: userId,
        raffleId: raffleId,
        purchaseDate: new Date()
      };

      const barcodeResult = await barcodeService.generateTicketBarcode(ticketData);
      if (!barcodeResult.success) {
        throw new Error('Failed to generate barcode');
      }

      const ticket = new Ticket({
        raffle: raffleId,
        user: userId,
        payment: payment._id,
        price: ticketPrice,
        quantity: 1, // Each ticket record represents 1 ticket
        totalAmount: ticketPrice,
        barcode: barcodeResult.barcode,
        qrCode: barcodeResult.qrCode,
        verificationUrl: barcodeResult.verificationUrl,
        status: 'pending', // Will be activated after payment
        expiresAt: raffle.drawDate
      });

      await ticket.save();
      tickets.push(ticket);
    }

    // Update payment with ticket references
    payment.tickets = tickets.map(ticket => ticket._id);
    await payment.save();

    // Create payment transaction with Midtrans
    const customerDetails = paymentService.generateCustomerDetails(req.user);
    const itemDetails = paymentService.generateItemDetails(raffle, quantity, ticketPrice);

    const paymentData = {
      orderId: payment.paymentId,
      amount: totalAmount,
      customerDetails,
      itemDetails,
      paymentMethod,
      enabledPayments: [paymentMethod]
    };

    const midtransResult = await paymentService.createTransaction(paymentData);
    if (!midtransResult.success) {
      // Rollback: delete tickets and payment
      await Ticket.deleteMany({ _id: { $in: tickets.map(t => t._id) } });
      await Payment.findByIdAndDelete(payment._id);
      
      return res.status(500).json({
        success: false,
        message: 'Gagal membuat transaksi pembayaran',
        error: midtransResult.error
      });
    }

    // Update payment with Midtrans data
    payment.paymentUrl = midtransResult.redirectUrl;
    payment.gatewayOrderId = payment.paymentId;
    payment.gatewayResponse = midtransResult.data;
    await payment.save();

    res.status(201).json({
      success: true,
      message: 'Tiket berhasil dibuat. Silakan lakukan pembayaran.',
      data: {
        payment: {
          id: payment._id,
          paymentId: payment.paymentId,
          amount: payment.amount,
          adminFee: payment.adminFee,
          totalAmount: payment.totalAmount,
          paymentMethod: payment.paymentMethod,
          paymentUrl: payment.paymentUrl,
          expiresAt: payment.expiresAt
        },
        tickets: tickets.map(ticket => ({
          id: ticket._id,
          ticketNumber: ticket.ticketNumber,
          barcode: ticket.barcode,
          status: ticket.status
        })),
        raffle: {
          id: raffle._id,
          title: raffle.title,
          ticketPrice: raffle.ticketPrice
        }
      }
    });
  } catch (error) {
    console.error('Purchase tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membeli tiket'
    });
  }
});

// @route   GET /api/tickets/verify/:barcode
// @desc    Verify ticket barcode
// @access  Public
router.get('/verify/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;

    // Validate barcode format
    if (!barcodeService.validateBarcodeFormat(barcode)) {
      return res.status(400).json({
        success: false,
        message: 'Format barcode tidak valid'
      });
    }

    // Find ticket by barcode
    const ticket = await Ticket.findByBarcode(barcode);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Tiket tidak ditemukan'
      });
    }

    // Add verification history
    await ticket.addVerification('verify', null, req.ip, req.get('User-Agent'));

    // Prepare response data
    const responseData = {
      ticket: {
        id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        isWinner: ticket.isWinner,
        purchaseDate: ticket.purchaseDate,
        expiresAt: ticket.expiresAt,
        isExpired: ticket.isExpired,
        canClaim: ticket.canClaim
      },
      raffle: {
        id: ticket.raffle._id,
        title: ticket.raffle.title,
        status: ticket.raffle.status,
        drawDate: ticket.raffle.drawDate
      },
      user: {
        fullName: ticket.user.fullName,
        whatsappNumber: ticket.user.whatsappNumber
      }
    };

    // Add prize information if winner
    if (ticket.isWinner && ticket.prizeWon) {
      responseData.prize = {
        id: ticket.prizeWon._id,
        name: ticket.prizeWon.name,
        description: ticket.prizeWon.description,
        value: ticket.prizeWon.value,
        image: ticket.prizeWon.image,
        claimInstructions: ticket.prizeWon.claimInstructions,
        claimStatus: ticket.claimStatus,
        claimedAt: ticket.claimedAt
      };
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Verify ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memverifikasi tiket'
    });
  }
});

// @route   POST /api/tickets/:id/claim
// @desc    Claim prize for winning ticket
// @access  Private
router.post('/:id/claim', authenticateToken, requireVerified, validateMongoId('id'), async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user._id;
    const { shippingAddress } = req.body;

    // Find ticket
    const ticket = await Ticket.findById(ticketId)
      .populate('raffle', 'title')
      .populate('prizeWon', 'name description value image claimInstructions shippingRequired')
      .populate('user', 'fullName whatsappNumber');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Tiket tidak ditemukan'
      });
    }

    // Check if user owns the ticket
    if (ticket.user._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke tiket ini'
      });
    }

    // Check if ticket is a winner
    if (!ticket.isWinner) {
      return res.status(400).json({
        success: false,
        message: 'Tiket ini bukan pemenang'
      });
    }

    // Check if prize can be claimed
    if (!ticket.canClaim) {
      return res.status(400).json({
        success: false,
        message: 'Hadiah tidak dapat diklaim atau sudah kedaluwarsa'
      });
    }

    // Validate shipping address if required
    if (ticket.prizeWon.shippingRequired && !shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Alamat pengiriman wajib diisi untuk hadiah ini'
      });
    }

    // Claim the prize
    await ticket.claimPrize();

    // Update prize with claim information
    if (ticket.prizeWon.shippingRequired && shippingAddress) {
      await ticket.prizeWon.claimPrize(userId, shippingAddress);
    } else {
      await ticket.prizeWon.claimPrize(userId);
    }

    // Add verification history
    await ticket.addVerification('claim', userId, req.ip, req.get('User-Agent'));

    // Send WhatsApp notification
    const whatsappResult = await whatsappService.sendPrizeClaimConfirmation(
      ticket.user.whatsappNumber,
      ticket.user.fullName,
      ticket.prizeWon.name
    );

    if (!whatsappResult.success) {
      console.error('Failed to send claim confirmation:', whatsappResult.error);
    }

    res.json({
      success: true,
      message: 'Hadiah berhasil diklaim',
      data: {
        ticket: {
          id: ticket._id,
          ticketNumber: ticket.ticketNumber,
          claimStatus: ticket.claimStatus,
          claimedAt: ticket.claimedAt
        },
        prize: {
          name: ticket.prizeWon.name,
          description: ticket.prizeWon.description,
          value: ticket.prizeWon.value,
          claimInstructions: ticket.prizeWon.claimInstructions
        }
      }
    });
  } catch (error) {
    console.error('Claim prize error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat mengklaim hadiah'
    });
  }
});

// @route   GET /api/tickets/user/:userId
// @desc    Get user's tickets
// @access  Private (Own tickets or Admin)
router.get('/user/:userId', authenticateToken, validateMongoId('userId'), validatePagination, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user._id.toString();

    // Check if user can access these tickets
    if (userId !== requestingUserId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak'
      });
    }

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

// @route   GET /api/tickets/raffle/:raffleId
// @desc    Get tickets for a specific raffle
// @access  Private (Admin only)
router.get('/raffle/:raffleId', authenticateToken, validateMongoId('raffleId'), validatePagination, async (req, res) => {
  try {
    // Only admin can view all tickets for a raffle
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak - hanya admin yang dapat melihat semua tiket'
      });
    }

    const { raffleId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      isWinner
    } = req.query;

    const options = {
      status,
      isWinner: isWinner !== undefined ? isWinner === 'true' : undefined
    };

    // Remove undefined values
    Object.keys(options).forEach(key => {
      if (options[key] === undefined) {
        delete options[key];
      }
    });

    const tickets = await Ticket.findRaffleTickets(raffleId, options);
    
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
    console.error('Get raffle tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data tiket undian'
    });
  }
});

// @route   GET /api/tickets/winners
// @desc    Get all winning tickets
// @access  Public
router.get('/winners', optionalAuth, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      raffleId
    } = req.query;

    const winners = await Ticket.findWinners(raffleId);
    
    // Hide sensitive information for public access
    const publicWinners = winners.map(winner => ({
      id: winner._id,
      ticketNumber: winner.ticketNumber,
      winningPosition: winner.winningPosition,
      wonAt: winner.wonAt,
      raffle: {
        id: winner.raffle._id,
        title: winner.raffle.title,
        drawDate: winner.raffle.drawDate
      },
      prize: {
        name: winner.prizeWon.name,
        description: winner.prizeWon.description,
        value: winner.prizeWon.value,
        position: winner.prizeWon.position
      },
      user: {
        // Only show partial name for privacy
        displayName: winner.user.fullName.charAt(0) + '***' + winner.user.fullName.slice(-1)
      }
    }));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedWinners = publicWinners.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        winners: paginatedWinners,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(publicWinners.length / limit),
          totalItems: publicWinners.length,
          itemsPerPage: parseInt(limit),
          hasNextPage: endIndex < publicWinners.length,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get winners error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data pemenang'
    });
  }
});

// @route   GET /api/tickets/:id
// @desc    Get single ticket details
// @access  Private (Owner or Admin)
router.get('/:id', authenticateToken, validateMongoId('id'), async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user._id.toString();

    const ticket = await Ticket.findById(ticketId)
      .populate('raffle', 'title status drawDate featuredImage')
      .populate('user', 'fullName whatsappNumber')
      .populate('prizeWon', 'name description value image claimInstructions')
      .populate('payment', 'paymentId totalAmount paymentMethod status');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Tiket tidak ditemukan'
      });
    }

    // Check if user can access this ticket
    if (ticket.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak'
      });
    }

    res.json({
      success: true,
      data: {
        ticket
      }
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data tiket'
    });
  }
});

module.exports = router;