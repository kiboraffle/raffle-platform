const express = require('express');
const { Payment, Ticket, Raffle, User } = require('../models');
const { authenticateToken, requireVerified } = require('../middleware/auth');
const { validateMongoId, validatePagination } = require('../middleware/validation');
const paymentService = require('../utils/payment');
const whatsappService = require('../utils/whatsapp');
const router = express.Router();

// @route   POST /api/payments/notification
// @desc    Handle payment notification webhook from Midtrans
// @access  Public (Webhook)
router.post('/notification', async (req, res) => {
  try {
    const notification = req.body;
    
    console.log('Received payment notification:', notification);

    // Process the notification
    const result = paymentService.processNotification(notification);
    
    if (!result.success) {
      console.error('Invalid notification:', result.error);
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    const {
      orderId,
      transactionId,
      paymentStatus,
      paymentType,
      amount,
      transactionTime,
      rawNotification
    } = result;

    // Find payment by order ID
    const payment = await Payment.findOne({ paymentId: orderId })
      .populate('user', 'fullName whatsappNumber')
      .populate('raffle', 'title')
      .populate('tickets');

    if (!payment) {
      console.error('Payment not found for order ID:', orderId);
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Add webhook history
    await payment.addWebhookHistory('midtrans', paymentStatus, rawNotification);

    // Handle different payment statuses
    switch (paymentStatus) {
      case 'paid':
        await handleSuccessfulPayment(payment, {
          transactionId,
          paymentType,
          transactionTime,
          response: rawNotification
        });
        break;
        
      case 'failed':
        await handleFailedPayment(payment, {
          response: rawNotification
        });
        break;
        
      case 'pending':
        // Update payment status to processing
        payment.status = 'processing';
        await payment.save();
        break;
        
      case 'challenge':
        // Handle fraud challenge
        payment.status = 'processing';
        payment.notes = 'Payment under fraud review';
        await payment.save();
        break;
        
      default:
        console.log('Unhandled payment status:', paymentStatus);
    }

    res.status(200).json({
      success: true,
      message: 'Notification processed successfully'
    });
  } catch (error) {
    console.error('Payment notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Handle successful payment
async function handleSuccessfulPayment(payment, gatewayData) {
  try {
    // Mark payment as paid
    await payment.markAsPaid(gatewayData);

    // Activate all tickets
    const ticketIds = payment.tickets.map(ticket => ticket._id || ticket);
    await Ticket.updateMany(
      { _id: { $in: ticketIds } },
      { 
        status: 'active',
        activatedAt: new Date()
      }
    );

    // Update raffle ticket count
    await Raffle.findByIdAndUpdate(
      payment.raffle._id,
      { 
        $inc: { 
          ticketsSold: payment.ticketQuantity,
          'statistics.totalRevenue': payment.totalAmount
        }
      }
    );

    // Update user statistics
    await User.findByIdAndUpdate(
      payment.user._id,
      {
        $inc: {
          totalTicketsPurchased: payment.ticketQuantity,
          totalAmountSpent: payment.totalAmount
        }
      }
    );

    // Get activated tickets for notification
    const activatedTickets = await Ticket.find({ _id: { $in: ticketIds } });
    const ticketNumbers = activatedTickets.map(ticket => ticket.ticketNumber);

    // Send WhatsApp confirmation
    const whatsappResult = await whatsappService.sendTicketPurchaseConfirmation(
      payment.user.whatsappNumber,
      payment.user.fullName,
      payment.raffle.title,
      payment.ticketQuantity,
      payment.totalAmount,
      ticketNumbers
    );

    if (!whatsappResult.success) {
      console.error('Failed to send purchase confirmation:', whatsappResult.error);
    }

    // Mark notifications as sent
    payment.notifications.userNotified = whatsappResult.success;
    payment.notifications.whatsappSent = whatsappResult.success;
    await payment.save();

    console.log(`Payment ${payment.paymentId} processed successfully`);
  } catch (error) {
    console.error('Error handling successful payment:', error);
    throw error;
  }
}

// Handle failed payment
async function handleFailedPayment(payment, gatewayData) {
  try {
    // Mark payment as failed
    await payment.markAsFailed('Payment failed', gatewayData);

    // Cancel all associated tickets
    const ticketIds = payment.tickets.map(ticket => ticket._id || ticket);
    await Ticket.updateMany(
      { _id: { $in: ticketIds } },
      { 
        status: 'cancelled',
        notes: 'Payment failed'
      }
    );

    console.log(`Payment ${payment.paymentId} marked as failed`);
  } catch (error) {
    console.error('Error handling failed payment:', error);
    throw error;
  }
}

// @route   GET /api/payments/status/:orderId
// @desc    Get payment status
// @access  Private
router.get('/status/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id.toString();

    // Find payment
    const payment = await Payment.findOne({ paymentId: orderId })
      .populate('raffle', 'title featuredImage')
      .populate('tickets', 'ticketNumber barcode status');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pembayaran tidak ditemukan'
      });
    }

    // Check if user owns this payment
    if (payment.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak'
      });
    }

    // Get latest status from Midtrans if payment is still pending
    if (payment.status === 'pending' || payment.status === 'processing') {
      const statusResult = await paymentService.getTransactionStatus(orderId);
      
      if (statusResult.success) {
        const midtransData = statusResult.data;
        const processResult = paymentService.processNotification(midtransData);
        
        if (processResult.success && processResult.paymentStatus !== payment.status) {
          // Update payment status based on Midtrans response
          if (processResult.paymentStatus === 'paid') {
            await handleSuccessfulPayment(payment, {
              transactionId: midtransData.transaction_id,
              response: midtransData
            });
          } else if (processResult.paymentStatus === 'failed') {
            await handleFailedPayment(payment, {
              response: midtransData
            });
          }
          
          // Refresh payment data
          await payment.reload();
        }
      }
    }

    res.json({
      success: true,
      data: {
        payment: {
          id: payment._id,
          paymentId: payment.paymentId,
          status: payment.status,
          amount: payment.amount,
          adminFee: payment.adminFee,
          totalAmount: payment.totalAmount,
          paymentMethod: payment.paymentMethod,
          paymentUrl: payment.paymentUrl,
          expiresAt: payment.expiresAt,
          paidAt: payment.paidAt,
          isExpired: payment.isExpired,
          isPending: payment.isPending,
          isSuccessful: payment.isSuccessful,
          timeRemaining: payment.timeRemaining,
          createdAt: payment.createdAt
        },
        raffle: payment.raffle,
        tickets: payment.tickets
      }
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil status pembayaran'
    });
  }
});

// @route   POST /api/payments/:id/cancel
// @desc    Cancel payment
// @access  Private
router.post('/:id/cancel', authenticateToken, validateMongoId('id'), async (req, res) => {
  try {
    const paymentId = req.params.id;
    const userId = req.user._id.toString();
    const { reason } = req.body;

    // Find payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pembayaran tidak ditemukan'
      });
    }

    // Check if user owns this payment
    if (payment.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak'
      });
    }

    // Check if payment can be cancelled
    if (payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Pembayaran yang sudah berhasil tidak dapat dibatalkan'
      });
    }

    if (payment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Pembayaran sudah dibatalkan'
      });
    }

    // Cancel payment in Midtrans
    const cancelResult = await paymentService.cancelTransaction(payment.paymentId);
    if (!cancelResult.success) {
      console.error('Failed to cancel payment in Midtrans:', cancelResult.error);
    }

    // Cancel payment locally
    await payment.cancel(reason || 'Cancelled by user');

    // Cancel associated tickets
    await Ticket.updateMany(
      { payment: paymentId },
      { 
        status: 'cancelled',
        notes: 'Payment cancelled'
      }
    );

    res.json({
      success: true,
      message: 'Pembayaran berhasil dibatalkan',
      data: {
        payment: {
          id: payment._id,
          paymentId: payment.paymentId,
          status: payment.status,
          cancelledAt: payment.cancelledAt
        }
      }
    });
  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat membatalkan pembayaran'
    });
  }
});

// @route   GET /api/payments/user/:userId
// @desc    Get user's payment history
// @access  Private (Own payments or Admin)
router.get('/user/:userId', authenticateToken, validateMongoId('userId'), validatePagination, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user._id.toString();

    // Check if user can access these payments
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

// @route   GET /api/payments/methods
// @desc    Get available payment methods
// @access  Public
router.get('/methods', async (req, res) => {
  try {
    const paymentMethods = paymentService.getAvailablePaymentMethods();
    
    res.json({
      success: true,
      data: {
        paymentMethods
      }
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil metode pembayaran'
    });
  }
});

// @route   POST /api/payments/:id/refund
// @desc    Process refund for payment
// @access  Private (Admin only)
router.post('/:id/refund', authenticateToken, validateMongoId('id'), async (req, res) => {
  try {
    // Only admin can process refunds
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak - hanya admin yang dapat memproses refund'
      });
    }

    const paymentId = req.params.id;
    const { amount, reason } = req.body;

    if (!amount || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Jumlah refund dan alasan wajib diisi'
      });
    }

    // Find payment
    const payment = await Payment.findById(paymentId)
      .populate('user', 'fullName whatsappNumber');
      
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pembayaran tidak ditemukan'
      });
    }

    if (payment.status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Hanya pembayaran yang berhasil yang dapat direfund'
      });
    }

    if (amount > payment.totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Jumlah refund tidak boleh melebihi total pembayaran'
      });
    }

    // Process refund with Midtrans
    const refundData = {
      amount: amount,
      reason: reason
    };

    const refundResult = await paymentService.refundTransaction(
      payment.paymentId,
      refundData
    );

    if (!refundResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Gagal memproses refund di payment gateway',
        error: refundResult.error
      });
    }

    // Update payment record
    await payment.processRefund(amount, reason);

    // Cancel associated tickets if full refund
    if (amount === payment.totalAmount) {
      await Ticket.updateMany(
        { payment: paymentId },
        { 
          status: 'cancelled',
          notes: 'Full refund processed'
        }
      );

      // Update raffle statistics
      await Raffle.findByIdAndUpdate(
        payment.raffle,
        {
          $inc: {
            ticketsSold: -payment.ticketQuantity,
            'statistics.totalRevenue': -payment.totalAmount
          }
        }
      );
    }

    res.json({
      success: true,
      message: 'Refund berhasil diproses',
      data: {
        payment: {
          id: payment._id,
          paymentId: payment.paymentId,
          status: payment.status,
          refundAmount: payment.refundAmount,
          refundedAt: payment.refundedAt
        },
        refundResult: refundResult.data
      }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat memproses refund'
    });
  }
});

// @route   GET /api/payments/:id
// @desc    Get single payment details
// @access  Private (Owner or Admin)
router.get('/:id', authenticateToken, validateMongoId('id'), async (req, res) => {
  try {
    const paymentId = req.params.id;
    const userId = req.user._id.toString();

    const payment = await Payment.findById(paymentId)
      .populate('user', 'fullName whatsappNumber email')
      .populate('raffle', 'title featuredImage status')
      .populate('tickets', 'ticketNumber barcode status isWinner');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pembayaran tidak ditemukan'
      });
    }

    // Check if user can access this payment
    if (payment.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak'
      });
    }

    res.json({
      success: true,
      data: {
        payment
      }
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data pembayaran'
    });
  }
});

module.exports = router;