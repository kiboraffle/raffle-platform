const axios = require('axios');
const crypto = require('crypto');

class PaymentService {
  constructor() {
    this.midtransServerKey = process.env.MIDTRANS_SERVER_KEY;
    this.midtransClientKey = process.env.MIDTRANS_CLIENT_KEY;
    this.isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    this.notificationUrl = process.env.MIDTRANS_NOTIFICATION_URL;
    
    // Set base URL berdasarkan environment
    this.baseUrl = this.isProduction 
      ? 'https://api.midtrans.com/v2'
      : 'https://api.sandbox.midtrans.com/v2';
    
    this.snapUrl = this.isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
  }

  // Generate authorization header
  getAuthHeader() {
    const auth = Buffer.from(this.midtransServerKey + ':').toString('base64');
    return `Basic ${auth}`;
  }

  // Create payment transaction
  async createTransaction(paymentData) {
    try {
      const {
        orderId,
        amount,
        customerDetails,
        itemDetails,
        paymentMethod,
        enabledPayments = []
      } = paymentData;

      const transactionDetails = {
        order_id: orderId,
        gross_amount: amount
      };

      const payload = {
        transaction_details: transactionDetails,
        customer_details: customerDetails,
        item_details: itemDetails,
        callbacks: {
          finish: `${process.env.FRONTEND_URL}/payment/finish`,
          error: `${process.env.FRONTEND_URL}/payment/error`,
          pending: `${process.env.FRONTEND_URL}/payment/pending`
        },
        expiry: {
          start_time: new Date().toISOString(),
          unit: 'hours',
          duration: 24
        }
      };

      // Set payment methods berdasarkan pilihan
      if (enabledPayments.length > 0) {
        payload.enabled_payments = enabledPayments;
      }

      // Konfigurasi khusus berdasarkan metode pembayaran
      switch (paymentMethod) {
        case 'bank_transfer':
          payload.enabled_payments = ['bank_transfer'];
          payload.bank_transfer = {
            bank: 'bca,bni,bri,mandiri,permata'
          };
          break;
          
        case 'virtual_account':
          payload.enabled_payments = ['bca_va', 'bni_va', 'bri_va', 'other_va'];
          break;
          
        case 'credit_card':
          payload.enabled_payments = ['credit_card'];
          payload.credit_card = {
            secure: true,
            save_card: false,
            channel: 'migs'
          };
          break;
          
        case 'gopay':
          payload.enabled_payments = ['gopay'];
          break;
          
        case 'ovo':
          payload.enabled_payments = ['ovo'];
          break;
          
        case 'dana':
          payload.enabled_payments = ['dana'];
          break;
          
        case 'shopeepay':
          payload.enabled_payments = ['shopeepay'];
          break;
          
        case 'qris':
          payload.enabled_payments = ['qris'];
          break;
          
        case 'indomaret':
          payload.enabled_payments = ['cstore'];
          payload.cstore = {
            store: 'indomaret'
          };
          break;
          
        case 'alfamart':
          payload.enabled_payments = ['cstore'];
          payload.cstore = {
            store: 'alfamart'
          };
          break;
      }

      const response = await axios.post(
        this.snapUrl,
        payload,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return {
        success: true,
        token: response.data.token,
        redirectUrl: response.data.redirect_url,
        data: response.data
      };
    } catch (error) {
      console.error('Midtrans create transaction error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Create direct charge (untuk metode pembayaran tertentu)
  async createDirectCharge(chargeData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/charge`,
        chargeData,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Midtrans direct charge error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Get transaction status
  async getTransactionStatus(orderId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${orderId}/status`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Midtrans get status error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Cancel transaction
  async cancelTransaction(orderId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${orderId}/cancel`,
        {},
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Midtrans cancel transaction error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Approve transaction (untuk credit card)
  async approveTransaction(orderId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${orderId}/approve`,
        {},
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Midtrans approve transaction error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Refund transaction
  async refundTransaction(orderId, refundData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${orderId}/refund`,
        refundData,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Midtrans refund transaction error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Verify notification signature
  verifyNotificationSignature(notification) {
    try {
      const {
        order_id,
        status_code,
        gross_amount,
        signature_key
      } = notification;

      const input = order_id + status_code + gross_amount + this.midtransServerKey;
      const hash = crypto.createHash('sha512').update(input).digest('hex');

      return hash === signature_key;
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  // Process notification webhook
  processNotification(notification) {
    try {
      // Verifikasi signature
      if (!this.verifyNotificationSignature(notification)) {
        return {
          success: false,
          error: 'Invalid signature'
        };
      }

      const {
        order_id,
        transaction_status,
        fraud_status,
        payment_type,
        transaction_id,
        transaction_time,
        gross_amount
      } = notification;

      let paymentStatus = 'pending';

      // Tentukan status pembayaran berdasarkan response Midtrans
      if (transaction_status === 'capture') {
        if (fraud_status === 'challenge') {
          paymentStatus = 'challenge';
        } else if (fraud_status === 'accept') {
          paymentStatus = 'paid';
        }
      } else if (transaction_status === 'settlement') {
        paymentStatus = 'paid';
      } else if (transaction_status === 'cancel' || 
                 transaction_status === 'deny' || 
                 transaction_status === 'expire') {
        paymentStatus = 'failed';
      } else if (transaction_status === 'pending') {
        paymentStatus = 'pending';
      }

      return {
        success: true,
        orderId: order_id,
        transactionId: transaction_id,
        paymentStatus,
        paymentType: payment_type,
        amount: parseFloat(gross_amount),
        transactionTime: transaction_time,
        rawNotification: notification
      };
    } catch (error) {
      console.error('Error processing notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate customer details untuk Midtrans
  generateCustomerDetails(user, billingAddress = null) {
    const customerDetails = {
      first_name: user.fullName.split(' ')[0],
      last_name: user.fullName.split(' ').slice(1).join(' ') || '',
      email: user.email || `${user.whatsappNumber}@raffle.com`,
      phone: user.whatsappNumber
    };

    if (billingAddress || user.address) {
      const address = billingAddress || user.address;
      customerDetails.billing_address = {
        first_name: customerDetails.first_name,
        last_name: customerDetails.last_name,
        email: customerDetails.email,
        phone: customerDetails.phone,
        address: address.street || '',
        city: address.city || '',
        postal_code: address.postalCode || '',
        country_code: 'IDN'
      };
    }

    return customerDetails;
  }

  // Generate item details untuk Midtrans
  generateItemDetails(raffle, quantity, ticketPrice) {
    return [{
      id: raffle._id.toString(),
      price: ticketPrice,
      quantity: quantity,
      name: `Tiket ${raffle.title}`,
      brand: 'Raffle Platform',
      category: raffle.category || 'raffle_ticket',
      merchant_name: 'Raffle Platform'
    }];
  }

  // Calculate admin fee
  calculateAdminFee(amount, paymentMethod) {
    let feePercentage = 0;
    let fixedFee = 0;

    switch (paymentMethod) {
      case 'credit_card':
        feePercentage = 2.9; // 2.9%
        fixedFee = 2000; // Rp 2.000
        break;
      case 'bank_transfer':
      case 'virtual_account':
        fixedFee = 4000; // Rp 4.000
        break;
      case 'gopay':
      case 'ovo':
      case 'dana':
      case 'shopeepay':
        feePercentage = 2; // 2%
        break;
      case 'qris':
        feePercentage = 0.7; // 0.7%
        break;
      case 'indomaret':
      case 'alfamart':
        fixedFee = 5000; // Rp 5.000
        break;
      default:
        feePercentage = 2.9;
        fixedFee = 2000;
    }

    const percentageFee = Math.round(amount * (feePercentage / 100));
    return percentageFee + fixedFee;
  }

  // Get available payment methods
  getAvailablePaymentMethods() {
    return [
      {
        code: 'bank_transfer',
        name: 'Transfer Bank',
        description: 'Transfer melalui ATM, Internet Banking, atau Mobile Banking',
        fee: 'Rp 4.000',
        icon: '🏦'
      },
      {
        code: 'virtual_account',
        name: 'Virtual Account',
        description: 'Bayar melalui Virtual Account BCA, BNI, BRI, Mandiri',
        fee: 'Rp 4.000',
        icon: '💳'
      },
      {
        code: 'credit_card',
        name: 'Kartu Kredit',
        description: 'Visa, Mastercard, JCB, Amex',
        fee: '2.9% + Rp 2.000',
        icon: '💳'
      },
      {
        code: 'gopay',
        name: 'GoPay',
        description: 'Bayar dengan saldo GoPay',
        fee: '2%',
        icon: '🟢'
      },
      {
        code: 'ovo',
        name: 'OVO',
        description: 'Bayar dengan saldo OVO',
        fee: '2%',
        icon: '🟣'
      },
      {
        code: 'dana',
        name: 'DANA',
        description: 'Bayar dengan saldo DANA',
        fee: '2%',
        icon: '🔵'
      },
      {
        code: 'shopeepay',
        name: 'ShopeePay',
        description: 'Bayar dengan saldo ShopeePay',
        fee: '2%',
        icon: '🟠'
      },
      {
        code: 'qris',
        name: 'QRIS',
        description: 'Scan QR Code dengan aplikasi e-wallet apapun',
        fee: '0.7%',
        icon: '📱'
      },
      {
        code: 'indomaret',
        name: 'Indomaret',
        description: 'Bayar di kasir Indomaret terdekat',
        fee: 'Rp 5.000',
        icon: '🏪'
      },
      {
        code: 'alfamart',
        name: 'Alfamart',
        description: 'Bayar di kasir Alfamart terdekat',
        fee: 'Rp 5.000',
        icon: '🏪'
      }
    ];
  }
}

// Export singleton instance
module.exports = new PaymentService();