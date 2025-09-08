const axios = require('axios');

class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL;
    this.apiToken = process.env.WHATSAPP_API_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  }

  // Format nomor WhatsApp ke format internasional
  formatPhoneNumber(phoneNumber) {
    let formatted = phoneNumber.replace(/\D/g, '');
    
    if (formatted.startsWith('08')) {
      formatted = '62' + formatted.substring(1);
    } else if (formatted.startsWith('8')) {
      formatted = '62' + formatted;
    } else if (formatted.startsWith('0')) {
      formatted = '62' + formatted.substring(1);
    }
    
    return formatted;
  }

  // Kirim pesan teks sederhana
  async sendTextMessage(to, message) {
    try {
      const formattedNumber = this.formatPhoneNumber(to);
      
      const payload = {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data
      };
    } catch (error) {
      console.error('WhatsApp send message error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Kirim pesan template
  async sendTemplateMessage(to, templateName, languageCode = 'id', components = []) {
    try {
      const formattedNumber = this.formatPhoneNumber(to);
      
      const payload = {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: components
        }
      };

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        data: response.data
      };
    } catch (error) {
      console.error('WhatsApp send template error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Kirim kode OTP
  async sendOTP(phoneNumber, otpCode, userName = '') {
    const message = `🔐 *Kode Verifikasi Raffle Platform*\n\n` +
                   `Halo ${userName ? userName + '!' : '!'}\n\n` +
                   `Kode OTP Anda: *${otpCode}*\n\n` +
                   `Kode ini berlaku selama 5 menit.\n` +
                   `Jangan bagikan kode ini kepada siapa pun.\n\n` +
                   `Jika Anda tidak meminta kode ini, abaikan pesan ini.`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  // Kirim notifikasi registrasi berhasil
  async sendRegistrationSuccess(phoneNumber, userName) {
    const message = `🎉 *Selamat Datang di Raffle Platform!*\n\n` +
                   `Halo ${userName}!\n\n` +
                   `Akun Anda telah berhasil dibuat dan diverifikasi.\n` +
                   `Sekarang Anda dapat mulai berpartisipasi dalam undian menarik kami!\n\n` +
                   `✨ Jangan lewatkan kesempatan memenangkan hadiah-hadiah menarik!\n\n` +
                   `Terima kasih telah bergabung dengan kami! 🙏`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  // Kirim konfirmasi pembelian tiket
  async sendTicketPurchaseConfirmation(phoneNumber, userName, raffleTitle, ticketCount, totalAmount, ticketNumbers) {
    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(totalAmount);

    const message = `🎫 *Pembelian Tiket Berhasil!*\n\n` +
                   `Halo ${userName}!\n\n` +
                   `Tiket undian Anda telah berhasil dibeli:\n\n` +
                   `📋 Undian: ${raffleTitle}\n` +
                   `🎟️ Jumlah Tiket: ${ticketCount}\n` +
                   `💰 Total Pembayaran: ${formattedAmount}\n` +
                   `🔢 Nomor Tiket: ${ticketNumbers.join(', ')}\n\n` +
                   `Tiket Anda sudah aktif dan siap untuk diundi!\n` +
                   `Semoga beruntung! 🍀\n\n` +
                   `Cek status tiket di profil Anda.`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  // Kirim pengingat undian akan berakhir
  async sendRaffleEndingReminder(phoneNumber, userName, raffleTitle, hoursLeft) {
    const message = `⏰ *Pengingat Undian!*\n\n` +
                   `Halo ${userName}!\n\n` +
                   `Undian "${raffleTitle}" akan berakhir dalam ${hoursLeft} jam!\n\n` +
                   `Jangan lewatkan kesempatan terakhir untuk membeli tiket dan memenangkan hadiah menarik!\n\n` +
                   `🎯 Beli tiket sekarang sebelum terlambat!`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  // Kirim pengumuman pemenang
  async sendWinnerAnnouncement(phoneNumber, userName, raffleTitle, prizeName, prizeValue, claimInstructions) {
    const formattedValue = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(prizeValue);

    const message = `🎉 *SELAMAT! ANDA MENANG!* 🎉\n\n` +
                   `Halo ${userName}!\n\n` +
                   `Kami dengan senang hati mengumumkan bahwa Anda adalah PEMENANG dalam undian:\n\n` +
                   `🏆 Undian: ${raffleTitle}\n` +
                   `🎁 Hadiah: ${prizeName}\n` +
                   `💎 Nilai: ${formattedValue}\n\n` +
                   `📋 *Cara Klaim Hadiah:*\n${claimInstructions}\n\n` +
                   `Selamat dan terima kasih telah berpartisipasi! 🙏\n\n` +
                   `*Penting:* Segera klaim hadiah Anda sebelum batas waktu berakhir.`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  // Kirim notifikasi tidak menang
  async sendNotWinnerNotification(phoneNumber, userName, raffleTitle) {
    const message = `🎲 *Hasil Undian*\n\n` +
                   `Halo ${userName}!\n\n` +
                   `Terima kasih telah berpartisipasi dalam undian "${raffleTitle}".\n\n` +
                   `Sayangnya, kali ini Anda belum beruntung. Tapi jangan berkecil hati!\n\n` +
                   `🌟 Masih banyak undian menarik lainnya menunggu Anda!\n` +
                   `💪 Tetap semangat dan coba lagi!\n\n` +
                   `Terima kasih atas partisipasi Anda! 🙏`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  // Kirim notifikasi undian baru
  async sendNewRaffleNotification(phoneNumber, userName, raffleTitle, ticketPrice, endDate) {
    const formattedPrice = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(ticketPrice);

    const formattedDate = new Date(endDate).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const message = `🆕 *Undian Baru Tersedia!*\n\n` +
                   `Halo ${userName}!\n\n` +
                   `Ada undian baru yang menarik untuk Anda:\n\n` +
                   `🎯 Undian: ${raffleTitle}\n` +
                   `🎫 Harga Tiket: ${formattedPrice}\n` +
                   `📅 Berakhir: ${formattedDate}\n\n` +
                   `Jangan lewatkan kesempatan memenangkan hadiah-hadiah menarik!\n\n` +
                   `🚀 Beli tiket sekarang dan menangkan hadiahnya!`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  // Kirim notifikasi reset password
  async sendPasswordResetNotification(phoneNumber, userName, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const message = `🔐 *Reset Password*\n\n` +
                   `Halo ${userName}!\n\n` +
                   `Kami menerima permintaan untuk reset password akun Anda.\n\n` +
                   `Klik link berikut untuk reset password:\n${resetUrl}\n\n` +
                   `Link ini berlaku selama 1 jam.\n\n` +
                   `Jika Anda tidak meminta reset password, abaikan pesan ini.\n\n` +
                   `Untuk keamanan, jangan bagikan link ini kepada siapa pun.`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  // Kirim notifikasi klaim hadiah berhasil
  async sendPrizeClaimConfirmation(phoneNumber, userName, prizeName, trackingNumber = null) {
    let message = `✅ *Klaim Hadiah Berhasil!*\n\n` +
                  `Halo ${userName}!\n\n` +
                  `Hadiah "${prizeName}" Anda telah berhasil diklaim!\n\n`;

    if (trackingNumber) {
      message += `📦 Nomor Resi: ${trackingNumber}\n` +
                 `Hadiah sedang dalam proses pengiriman.\n\n`;
    }

    message += `Terima kasih telah berpartisipasi dalam undian kami!\n` +
               `Semoga Anda menikmati hadiah yang telah Anda menangkan! 🎉`;

    return await this.sendTextMessage(phoneNumber, message);
  }

  // Verifikasi webhook signature (untuk keamanan)
  verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.verifyToken)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }

  // Handle webhook dari WhatsApp
  handleWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verifikasi webhook
    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.error('WhatsApp webhook verification failed');
      res.status(403).send('Forbidden');
    }
  }

  // Process incoming messages
  processIncomingMessage(webhookData) {
    try {
      const entry = webhookData.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (messages && messages.length > 0) {
        const message = messages[0];
        const from = message.from;
        const messageType = message.type;
        const messageBody = message.text?.body || '';

        console.log(`Received message from ${from}: ${messageBody}`);

        // Di sini Anda bisa menambahkan logika untuk memproses pesan masuk
        // Misalnya: auto-reply, command processing, dll.
        
        return {
          success: true,
          from,
          messageType,
          messageBody
        };
      }

      return { success: false, error: 'No messages found' };
    } catch (error) {
      console.error('Error processing incoming message:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new WhatsAppService();