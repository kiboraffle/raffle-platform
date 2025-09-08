const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Pengguna wajib diisi']
  },
  raffle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Raffle',
    required: [true, 'Undian wajib diisi']
  },
  tickets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  }],
  amount: {
    type: Number,
    required: [true, 'Jumlah pembayaran wajib diisi'],
    min: [1000, 'Jumlah pembayaran minimal Rp 1.000']
  },
  ticketQuantity: {
    type: Number,
    required: [true, 'Jumlah tiket wajib diisi'],
    min: [1, 'Jumlah tiket minimal 1'],
    max: [100, 'Jumlah tiket maksimal 100 per transaksi']
  },
  ticketPrice: {
    type: Number,
    required: [true, 'Harga tiket wajib diisi'],
    min: [1000, 'Harga tiket minimal Rp 1.000']
  },
  adminFee: {
    type: Number,
    default: 0,
    min: [0, 'Biaya admin tidak boleh negatif']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total pembayaran wajib diisi'],
    min: [1000, 'Total pembayaran minimal Rp 1.000']
  },
  currency: {
    type: String,
    default: 'IDR',
    enum: ['IDR']
  },
  paymentMethod: {
    type: String,
    required: [true, 'Metode pembayaran wajib diisi'],
    enum: {
      values: [
        'bank_transfer',
        'virtual_account',
        'credit_card',
        'debit_card',
        'gopay',
        'ovo',
        'dana',
        'shopeepay',
        'linkaja',
        'qris',
        'indomaret',
        'alfamart'
      ],
      message: 'Metode pembayaran tidak valid'
    }
  },
  paymentChannel: {
    type: String,
    required: [true, 'Channel pembayaran wajib diisi']
  },
  status: {
    type: String,
    enum: {
      values: [
        'pending',
        'processing',
        'paid',
        'failed',
        'cancelled',
        'expired',
        'refunded',
        'partial_refund'
      ],
      message: 'Status pembayaran tidak valid'
    },
    default: 'pending'
  },
  gatewayProvider: {
    type: String,
    enum: ['midtrans', 'xendit', 'duitku', 'faspay'],
    required: [true, 'Provider gateway wajib diisi']
  },
  gatewayTransactionId: {
    type: String,
    index: true
  },
  gatewayOrderId: {
    type: String,
    index: true
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  paymentUrl: {
    type: String
  },
  qrCodeUrl: {
    type: String
  },
  virtualAccountNumber: {
    type: String
  },
  expiresAt: {
    type: Date,
    required: true
  },
  paidAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  refundedAt: {
    type: Date,
    default: null
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: [0, 'Jumlah refund tidak boleh negatif']
  },
  refundReason: {
    type: String,
    maxlength: [500, 'Alasan refund maksimal 500 karakter']
  },
  customerInfo: {
    name: {
      type: String,
      required: [true, 'Nama customer wajib diisi']
    },
    email: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Format email tidak valid'
      }
    },
    phone: {
      type: String,
      required: [true, 'Nomor telepon customer wajib diisi']
    }
  },
  billingAddress: {
    street: String,
    city: String,
    province: String,
    postalCode: String,
    country: {
      type: String,
      default: 'Indonesia'
    }
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceInfo: String,
    source: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web'
    },
    campaignCode: String,
    referralCode: String
  },
  notifications: {
    webhookReceived: {
      type: Boolean,
      default: false
    },
    userNotified: {
      type: Boolean,
      default: false
    },
    adminNotified: {
      type: Boolean,
      default: false
    },
    whatsappSent: {
      type: Boolean,
      default: false
    }
  },
  webhookHistory: [{
    receivedAt: {
      type: Date,
      default: Date.now
    },
    provider: String,
    event: String,
    data: mongoose.Schema.Types.Mixed,
    processed: {
      type: Boolean,
      default: false
    }
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Catatan maksimal 1000 karakter']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ raffle: 1, status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ gatewayTransactionId: 1 });
paymentSchema.index({ gatewayOrderId: 1 });
paymentSchema.index({ expiresAt: 1 });
paymentSchema.index({ paidAt: -1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ gatewayProvider: 1 });

// Virtual for is expired
paymentSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt && this.status === 'pending';
});

// Virtual for is successful
paymentSchema.virtual('isSuccessful').get(function() {
  return this.status === 'paid';
});

// Virtual for is pending
paymentSchema.virtual('isPending').get(function() {
  return this.status === 'pending' && !this.isExpired;
});

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(this.amount);
});

// Virtual for formatted total
paymentSchema.virtual('formattedTotal').get(function() {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(this.totalAmount);
});

// Virtual for time remaining
paymentSchema.virtual('timeRemaining').get(function() {
  if (this.status !== 'pending') return null;
  
  const now = new Date();
  const expires = new Date(this.expiresAt);
  const diff = expires - now;
  
  if (diff <= 0) return null;
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds, total: diff };
});

// Pre-save middleware
paymentSchema.pre('save', function(next) {
  // Generate payment ID if not exists
  if (!this.paymentId) {
    this.paymentId = this.generatePaymentId();
  }
  
  // Calculate total amount
  this.totalAmount = this.amount + this.adminFee;
  
  // Set expiration time (default 24 hours)
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Method to generate payment ID
paymentSchema.methods.generatePaymentId = function() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `PAY-${timestamp}-${random}`;
};

// Method to mark as paid
paymentSchema.methods.markAsPaid = function(gatewayData = {}) {
  if (this.status !== 'pending' && this.status !== 'processing') {
    throw new Error('Pembayaran tidak dapat diubah statusnya');
  }
  
  this.status = 'paid';
  this.paidAt = new Date();
  
  if (gatewayData.transactionId) {
    this.gatewayTransactionId = gatewayData.transactionId;
  }
  
  if (gatewayData.response) {
    this.gatewayResponse = { ...this.gatewayResponse, ...gatewayData.response };
  }
  
  return this.save();
};

// Method to mark as failed
paymentSchema.methods.markAsFailed = function(reason, gatewayData = {}) {
  if (this.status === 'paid') {
    throw new Error('Pembayaran yang sudah berhasil tidak dapat diubah menjadi gagal');
  }
  
  this.status = 'failed';
  this.failedAt = new Date();
  this.notes = reason;
  
  if (gatewayData.response) {
    this.gatewayResponse = { ...this.gatewayResponse, ...gatewayData.response };
  }
  
  return this.save();
};

// Method to cancel payment
paymentSchema.methods.cancel = function(reason) {
  if (['paid', 'refunded'].includes(this.status)) {
    throw new Error('Pembayaran tidak dapat dibatalkan');
  }
  
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.notes = reason;
  
  return this.save();
};

// Method to process refund
paymentSchema.methods.processRefund = function(amount, reason) {
  if (this.status !== 'paid') {
    throw new Error('Hanya pembayaran yang berhasil yang dapat direfund');
  }
  
  if (amount > this.totalAmount) {
    throw new Error('Jumlah refund tidak boleh melebihi total pembayaran');
  }
  
  this.refundAmount = amount;
  this.refundReason = reason;
  this.refundedAt = new Date();
  
  if (amount === this.totalAmount) {
    this.status = 'refunded';
  } else {
    this.status = 'partial_refund';
  }
  
  return this.save();
};

// Method to add webhook history
paymentSchema.methods.addWebhookHistory = function(provider, event, data) {
  this.webhookHistory.push({
    provider,
    event,
    data,
    receivedAt: new Date()
  });
  
  this.notifications.webhookReceived = true;
  
  return this.save();
};

// Method to update gateway response
paymentSchema.methods.updateGatewayResponse = function(response) {
  this.gatewayResponse = { ...this.gatewayResponse, ...response };
  return this.save();
};

// Static method to find by gateway transaction ID
paymentSchema.statics.findByGatewayTransactionId = function(transactionId) {
  return this.findOne({ gatewayTransactionId: transactionId })
    .populate('user', 'fullName whatsappNumber email')
    .populate('raffle', 'title status')
    .populate('tickets');
};

// Static method to find user payments
paymentSchema.statics.findUserPayments = function(userId, options = {}) {
  const query = { user: userId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.raffleId) {
    query.raffle = options.raffleId;
  }
  
  return this.find(query)
    .populate('raffle', 'title featuredImage status')
    .populate('tickets', 'ticketNumber barcode')
    .sort({ createdAt: -1 });
};

// Static method to find expired payments
paymentSchema.statics.findExpired = function() {
  return this.find({
    status: 'pending',
    expiresAt: { $lt: new Date() }
  });
};

// Static method to get payment statistics
paymentSchema.statics.getStats = function(startDate, endDate) {
  const matchStage = {
    createdAt: {
      $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      $lte: endDate || new Date()
    }
  };
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        avgAmount: { $avg: '$totalAmount' }
      }
    },
    {
      $group: {
        _id: null,
        statusBreakdown: {
          $push: {
            status: '$_id',
            count: '$count',
            totalAmount: '$totalAmount',
            avgAmount: '$avgAmount'
          }
        },
        totalTransactions: { $sum: '$count' },
        totalRevenue: {
          $sum: {
            $cond: [
              { $eq: ['$_id', 'paid'] },
              '$totalAmount',
              0
            ]
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Payment', paymentSchema);