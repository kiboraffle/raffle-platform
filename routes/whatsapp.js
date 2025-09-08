const express = require('express');
const { User, Raffle, Ticket } = require('../models');
const whatsappService = require('../utils/whatsapp');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/whatsapp/webhook
// @desc    Verify WhatsApp webhook
// @access  Public (Webhook verification)
router.get('/webhook', (req, res) => {
  try {
    whatsappService.handleWebhook(req, res);
  } catch (error) {
    console.error('WhatsApp webhook verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook verification failed'
    });
  }
});

// @route   POST /api/whatsapp/webhook
// @desc    Handle incoming WhatsApp messages
// @access  Public (Webhook)
router.post('/webhook', (req, res) => {
  try {
    const webhookData = req.body;
    
    // Process incoming message
    const result = whatsappService.processIncomingMessage(webhookData);
    
    if (result.success) {
      console.log('Processed incoming WhatsApp message:', result);
      
      // Here you can add logic to handle different types of incoming messages
      // For example: auto-replies, command processing, customer support, etc.
      
      // Example: Auto-reply for certain keywords
      handleAutoReply(result.from, result.messageBody);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).json({
      success: true,
      message: 'Webhook received'
    });
  } catch (error) {
    console.error('WhatsApp webhook processing error:', error);
    res.status(200).json({
      success: true,
      message: 'Webhook received'
    });
  }
});

// Handle auto-reply logic
async function handleAutoReply(phoneNumber, messageBody) {
  try {
    const message = messageBody.toLowerCase().trim();
    
    // Define auto-reply responses
    const autoReplies = {
      'info': 'Halo! Selamat datang di Platform Undian Digital. Ketik "help" untuk melihat menu bantuan.',
      'help': '📋 *Menu Bantuan*\n\n' +
              '• Ketik "undian" - Lihat undian aktif\n' +
              '• Ketik "tiket" - Cek tiket Anda\n' +
              '• Ketik "pemenang" - Lihat pemenang terbaru\n' +
              '• Ketik "kontak" - Hubungi customer service\n\n' +
              'Atau kunjungi website kami untuk pengalaman lengkap!',
      'undian': '🎯 *Undian Aktif*\n\n' +
                'Lihat semua undian menarik yang sedang berlangsung di website kami.\n' +
                'Jangan lewatkan kesempatan memenangkan hadiah-hadiah fantastis!',
      'tiket': '🎫 *Cek Tiket Anda*\n\n' +
               'Login ke akun Anda di website untuk melihat semua tiket yang Anda miliki.\n' +
               'Pantau status tiket dan hasil undian secara real-time!',
      'pemenang': '🏆 *Pemenang Terbaru*\n\n' +
                  'Selamat kepada para pemenang! Lihat daftar lengkap pemenang di website kami.\n' +
                  'Siapa tahu Anda pemenang berikutnya!',
      'kontak': '📞 *Customer Service*\n\n' +
                'Butuh bantuan? Tim customer service kami siap membantu Anda 24/7.\n' +
                'Email: support@raffleplatform.com\n' +
                'WhatsApp: +62-XXX-XXXX-XXXX'
    };
    
    // Check if message matches any auto-reply keyword
    for (const [keyword, reply] of Object.entries(autoReplies)) {
      if (message.includes(keyword)) {
        await whatsappService.sendTextMessage(phoneNumber, reply);
        break;
      }
    }
    
    // Handle specific commands
    if (message.startsWith('cek tiket ')) {
      const ticketNumber = message.replace('cek tiket ', '').trim();
      await handleTicketCheck(phoneNumber, ticketNumber);
    }
    
  } catch (error) {
    console.error('Auto-reply error:', error);
  }
}

// Handle ticket check command
async function handleTicketCheck(phoneNumber, ticketNumber) {
  try {
    const ticket = await Ticket.findOne({ ticketNumber })
      .populate('raffle', 'title status')
      .populate('user', 'whatsappNumber');
    
    if (!ticket) {
      await whatsappService.sendTextMessage(
        phoneNumber,
        '❌ Tiket tidak ditemukan. Pastikan nomor tiket yang Anda masukkan benar.'
      );
      return;
    }
    
    // Check if the phone number matches the ticket owner
    const userPhone = whatsappService.formatPhoneNumber(ticket.user.whatsappNumber);
    const requestPhone = whatsappService.formatPhoneNumber(phoneNumber);
    
    if (userPhone !== requestPhone) {
      await whatsappService.sendTextMessage(
        phoneNumber,
        '🔒 Tiket ini bukan milik nomor WhatsApp Anda.'
      );
      return;
    }
    
    // Send ticket information
    let statusEmoji = '⏳';
    let statusText = 'Pending';
    
    switch (ticket.status) {
      case 'active':
        statusEmoji = '✅';
        statusText = 'Aktif';
        break;
      case 'used':
        statusEmoji = '🎉';
        statusText = 'Digunakan';
        break;
      case 'expired':
        statusEmoji = '⏰';
        statusText = 'Kedaluwarsa';
        break;
      case 'cancelled':
        statusEmoji = '❌';
        statusText = 'Dibatalkan';
        break;
    }
    
    const message = `🎫 *Informasi Tiket*\n\n` +
                   `Nomor Tiket: ${ticket.ticketNumber}\n` +
                   `Undian: ${ticket.raffle.title}\n` +
                   `Status: ${statusEmoji} ${statusText}\n` +
                   `Tanggal Beli: ${ticket.purchaseDate.toLocaleDateString('id-ID')}\n\n` +
                   (ticket.isWinner ? 
                     '🏆 *SELAMAT! Anda adalah PEMENANG!*\n' +
                     'Silakan klaim hadiah Anda melalui website.' :
                     'Semoga beruntung di pengundian!');
    
    await whatsappService.sendTextMessage(phoneNumber, message);
    
  } catch (error) {
    console.error('Ticket check error:', error);
    await whatsappService.sendTextMessage(
      phoneNumber,
      '❌ Terjadi kesalahan saat mengecek tiket. Silakan coba lagi nanti.'
    );
  }
}

// @route   POST /api/whatsapp/send-otp
// @desc    Send OTP to phone number (for testing)
// @access  Private (Admin only)
router.post('/send-otp', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { phoneNumber, userName } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Nomor WhatsApp wajib diisi'
      });
    }
    
    // Generate test OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const result = await whatsappService.sendOTP(phoneNumber, otpCode, userName);
    
    res.json({
      success: result.success,
      message: result.success ? 'OTP berhasil dikirim' : 'Gagal mengirim OTP',
      data: {
        phoneNumber,
        otpCode: result.success ? otpCode : null,
        messageId: result.messageId
      },
      error: result.error
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengirim OTP'
    });
  }
});

// @route   POST /api/whatsapp/send-notification
// @desc    Send custom notification
// @access  Private (Admin only)
router.post('/send-notification', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { phoneNumber, message, type = 'text' } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Nomor WhatsApp dan pesan wajib diisi'
      });
    }
    
    let result;
    
    if (type === 'text') {
      result = await whatsappService.sendTextMessage(phoneNumber, message);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Tipe pesan tidak didukung'
      });
    }
    
    res.json({
      success: result.success,
      message: result.success ? 'Notifikasi berhasil dikirim' : 'Gagal mengirim notifikasi',
      data: {
        phoneNumber,
        messageId: result.messageId
      },
      error: result.error
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengirim notifikasi'
    });
  }
});

// @route   POST /api/whatsapp/broadcast
// @desc    Send broadcast message to multiple users
// @access  Private (Admin only)
router.post('/broadcast', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userIds, message, type = 'text' } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Daftar user ID wajib diisi'
      });
    }
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Pesan wajib diisi'
      });
    }
    
    // Get users
    const users = await User.find({
      _id: { $in: userIds },
      isActive: true,
      isVerified: true
    }).select('whatsappNumber fullName');
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada pengguna yang valid ditemukan'
      });
    }
    
    // Send messages
    const results = [];
    
    for (const user of users) {
      try {
        let result;
        
        if (type === 'text') {
          result = await whatsappService.sendTextMessage(user.whatsappNumber, message);
        }
        
        results.push({
          userId: user._id,
          phoneNumber: user.whatsappNumber,
          fullName: user.fullName,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });
        
        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error sending to ${user.whatsappNumber}:`, error);
        results.push({
          userId: user._id,
          phoneNumber: user.whatsappNumber,
          fullName: user.fullName,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      message: `Broadcast selesai. ${successCount} berhasil, ${failCount} gagal.`,
      data: {
        totalUsers: users.length,
        successCount,
        failCount,
        results
      }
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengirim broadcast'
    });
  }
});

// @route   POST /api/whatsapp/send-raffle-reminder
// @desc    Send raffle ending reminder to participants
// @access  Private (Admin only)
router.post('/send-raffle-reminder', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { raffleId, hoursLeft } = req.body;
    
    if (!raffleId || !hoursLeft) {
      return res.status(400).json({
        success: false,
        message: 'Raffle ID dan jam tersisa wajib diisi'
      });
    }
    
    // Get raffle
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
          _id: '$user'
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
          whatsappNumber: '$user.whatsappNumber',
          fullName: '$user.fullName'
        }
      }
    ]);
    
    if (participants.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada peserta ditemukan'
      });
    }
    
    // Send reminders
    const results = [];
    
    for (const participant of participants) {
      try {
        const result = await whatsappService.sendRaffleEndingReminder(
          participant.whatsappNumber,
          participant.fullName,
          raffle.title,
          hoursLeft
        );
        
        results.push({
          userId: participant.userId,
          phoneNumber: participant.whatsappNumber,
          fullName: participant.fullName,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });
        
        // Add delay between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error sending reminder to ${participant.whatsappNumber}:`, error);
        results.push({
          userId: participant.userId,
          phoneNumber: participant.whatsappNumber,
          fullName: participant.fullName,
          success: false,
          error: error.message
        });
      }
    }
    
    // Update raffle notification status
    raffle.notifications.endingSoonSent = true;
    await raffle.save();
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      message: `Pengingat undian berhasil dikirim. ${successCount} berhasil, ${failCount} gagal.`,
      data: {
        raffleTitle: raffle.title,
        totalParticipants: participants.length,
        successCount,
        failCount,
        results
      }
    });
  } catch (error) {
    console.error('Send raffle reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengirim pengingat undian'
    });
  }
});

// @route   GET /api/whatsapp/status
// @desc    Get WhatsApp service status
// @access  Private (Admin only)
router.get('/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Test WhatsApp service by sending a test message to admin
    const testResult = await whatsappService.sendTextMessage(
      req.user.whatsappNumber,
      '✅ WhatsApp service is working properly. This is a test message.'
    );
    
    res.json({
      success: true,
      data: {
        whatsappService: {
          status: testResult.success ? 'active' : 'error',
          apiUrl: whatsappService.apiUrl ? 'configured' : 'not configured',
          apiToken: whatsappService.apiToken ? 'configured' : 'not configured',
          phoneNumberId: whatsappService.phoneNumberId ? 'configured' : 'not configured',
          testMessage: {
            sent: testResult.success,
            messageId: testResult.messageId,
            error: testResult.error
          }
        }
      }
    });
  } catch (error) {
    console.error('WhatsApp status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengecek status WhatsApp service'
    });
  }
});

module.exports = router;