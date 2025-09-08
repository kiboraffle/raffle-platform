const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  raffle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Raffle',
    required: [true, 'Undian wajib diisi']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Pengguna wajib diisi']
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: [true, 'Pembayaran wajib diisi']
  },
  price: {
    type: Number,
    required: [true, 'Harga tiket wajib diisi'],
    min: [0, 'Harga tiket tidak boleh negatif']
  },
  quantity: {
    type: Number,
    required: [true, 'Jumlah tiket wajib diisi'],
    min: [1, 'Jumlah tiket minimal 1'],
    max: [100, 'Jumlah tiket maksimal 100 per transaksi']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total pembayaran wajib diisi'],
    min: [0, 'Total pembayaran tidak boleh negatif']
  },
  barcode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  qrCode: {
    type: String,
    required: true
  },
  verificationUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'active', 'used', 'expired', 'cancelled'],
      message: 'Status tiket tidak valid'
    },
    default: 'pending'
  },
  isWinner: {
    type: Boolean,
    default: false
  },
  prizeWon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prize',
    default: null
  },
  winningPosition: {
    type: Number,
    default: null
  },
  wonAt: {
    type: Date,
    default: null
  },
  claimStatus: {
    type: String,
    enum: ['not_applicable', 'pending', 'claimed', 'expired'],
    default: 'not_applicable'
  },
  claimedAt: {
    type: Date,
    default: null
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  activatedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    required: true
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceInfo: String,
    purchaseSource: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web'
    }
  },
  verificationHistory: [{
    verifiedAt: {
      type: Date,
      default: Date.now
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    ipAddress: String,
    userAgent: String,
    action: {
      type: String,
      enum: ['scan', 'verify', 'claim'],
      required: true
    }
  }],
  notes: {
    type: String,
    maxlength: [500, 'Catatan maksimal 500 karakter']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ticketSchema.index({ raffle: 1, user: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ isWinner: 1 });
ticketSchema.index({ purchaseDate: -1 });
ticketSchema.index({ expiresAt: 1 });
ticketSchema.index({ claimStatus: 1 });
ticketSchema.index({ barcode: 1 }, { unique: true });
ticketSchema.index({ ticketNumber: 1 }, { unique: true });

// Virtual for is expired
ticketSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

// Virtual for is active
ticketSchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.isExpired;
});

// Virtual for can claim
ticketSchema.virtual('canClaim').get(function() {
  return this.isWinner && 
         this.claimStatus === 'pending' && 
         !this.isExpired;
});

// Virtual for formatted price
ticketSchema.virtual('formattedPrice').get(function() {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(this.price);
});

// Virtual for formatted total
ticketSchema.virtual('formattedTotal').get(function() {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(this.totalAmount);
});

// Pre-save middleware
ticketSchema.pre('save', function(next) {
  // Generate ticket number if not exists
  if (!this.ticketNumber) {
    this.ticketNumber = this.generateTicketNumber();
  }
  
  // Generate barcode if not exists
  if (!this.barcode) {
    this.barcode = this.generateBarcode();
  }
  
  // Generate verification URL if not exists
  if (!this.verificationUrl) {
    this.verificationUrl = this.generateVerificationUrl();
  }
  
  // Calculate total amount
  this.totalAmount = this.price * this.quantity;
  
  // Set expiration date based on raffle end date
  if (!this.expiresAt && this.raffle) {
    // Tickets expire 30 days after raffle draw date
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Method to generate ticket number
ticketSchema.methods.generateTicketNumber = function() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `TKT-${timestamp}-${random}`;
};

// Method to generate barcode
ticketSchema.methods.generateBarcode = function() {
  const uuid = uuidv4().replace(/-/g, '').toUpperCase();
  return `RFL${uuid}`;
};

// Method to generate verification URL
ticketSchema.methods.generateVerificationUrl = function() {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/verify/${this.barcode}`;
};

// Method to activate ticket
ticketSchema.methods.activate = function() {
  if (this.status !== 'pending') {
    throw new Error('Hanya tiket dengan status pending yang dapat diaktifkan');
  }
  
  this.status = 'active';
  this.activatedAt = new Date();
  
  return this.save();
};

// Method to mark as winner
ticketSchema.methods.markAsWinner = function(prizeId, position) {
  this.isWinner = true;
  this.prizeWon = prizeId;
  this.winningPosition = position;
  this.wonAt = new Date();
  this.claimStatus = 'pending';
  
  return this.save();
};

// Method to claim prize
ticketSchema.methods.claimPrize = function() {
  if (!this.isWinner) {
    throw new Error('Tiket ini bukan pemenang');
  }
  
  if (this.claimStatus !== 'pending') {
    throw new Error('Hadiah sudah diklaim atau tidak dapat diklaim');
  }
  
  if (this.isExpired) {
    this.claimStatus = 'expired';
    throw new Error('Tiket sudah kedaluwarsa');
  }
  
  this.claimStatus = 'claimed';
  this.claimedAt = new Date();
  this.status = 'used';
  
  return this.save();
};

// Method to add verification history
ticketSchema.methods.addVerification = function(action, userId = null, ipAddress = null, userAgent = null) {
  this.verificationHistory.push({
    action,
    verifiedBy: userId,
    ipAddress,
    userAgent,
    verifiedAt: new Date()
  });
  
  return this.save();
};

// Method to cancel ticket
ticketSchema.methods.cancel = function(reason) {
  if (['used', 'cancelled'].includes(this.status)) {
    throw new Error('Tiket tidak dapat dibatalkan');
  }
  
  this.status = 'cancelled';
  this.notes = reason;
  
  return this.save();
};

// Static method to find by barcode
ticketSchema.statics.findByBarcode = function(barcode) {
  return this.findOne({ barcode })
    .populate('raffle', 'title status drawDate')
    .populate('user', 'fullName whatsappNumber')
    .populate('prizeWon', 'name description value image claimInstructions');
};

// Static method to find user tickets
ticketSchema.statics.findUserTickets = function(userId, options = {}) {
  const query = { user: userId };
  
  if (options.raffleId) {
    query.raffle = options.raffleId;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.isWinner !== undefined) {
    query.isWinner = options.isWinner;
  }
  
  return this.find(query)
    .populate('raffle', 'title status drawDate featuredImage')
    .populate('prizeWon', 'name description value image position')
    .sort({ purchaseDate: -1 });
};

// Static method to find raffle tickets
ticketSchema.statics.findRaffleTickets = function(raffleId, options = {}) {
  const query = { raffle: raffleId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.isWinner !== undefined) {
    query.isWinner = options.isWinner;
  }
  
  return this.find(query)
    .populate('user', 'fullName whatsappNumber')
    .populate('prizeWon', 'name position')
    .sort({ purchaseDate: -1 });
};

// Static method to find winners
ticketSchema.statics.findWinners = function(raffleId = null) {
  const query = { isWinner: true };
  
  if (raffleId) {
    query.raffle = raffleId;
  }
  
  return this.find(query)
    .populate('raffle', 'title drawDate')
    .populate('user', 'fullName whatsappNumber')
    .populate('prizeWon', 'name description value image position')
    .sort({ winningPosition: 1, wonAt: -1 });
};

// Static method to find expired tickets
ticketSchema.statics.findExpired = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    status: { $in: ['active', 'pending'] }
  });
};

// Static method to get user statistics
ticketSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalTickets: { $sum: '$quantity' },
        totalSpent: { $sum: '$totalAmount' },
        totalWins: { $sum: { $cond: ['$isWinner', 1, 0] } },
        activeTickets: {
          $sum: {
            $cond: [
              { $eq: ['$status', 'active'] },
              '$quantity',
              0
            ]
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Ticket', ticketSchema);