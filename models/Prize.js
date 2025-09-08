const mongoose = require('mongoose');

const prizeSchema = new mongoose.Schema({
  raffle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Raffle',
    required: [true, 'Undian wajib diisi']
  },
  name: {
    type: String,
    required: [true, 'Nama hadiah wajib diisi'],
    trim: true,
    maxlength: [200, 'Nama hadiah maksimal 200 karakter']
  },
  description: {
    type: String,
    required: [true, 'Deskripsi hadiah wajib diisi'],
    trim: true,
    maxlength: [1000, 'Deskripsi hadiah maksimal 1000 karakter']
  },
  value: {
    type: Number,
    required: [true, 'Nilai hadiah wajib diisi'],
    min: [0, 'Nilai hadiah tidak boleh negatif']
  },
  quantity: {
    type: Number,
    required: [true, 'Jumlah hadiah wajib diisi'],
    min: [1, 'Jumlah hadiah minimal 1'],
    max: [100, 'Jumlah hadiah maksimal 100']
  },
  position: {
    type: Number,
    required: [true, 'Posisi hadiah wajib diisi'],
    min: [1, 'Posisi hadiah minimal 1'],
    validate: {
      validator: function(v) {
        return Number.isInteger(v);
      },
      message: 'Posisi hadiah harus berupa bilangan bulat'
    }
  },
  image: {
    type: String,
    required: [true, 'Gambar hadiah wajib diisi']
  },
  gallery: [{
    type: String
  }],
  category: {
    type: String,
    enum: {
      values: ['electronics', 'automotive', 'fashion', 'home', 'travel', 'cash', 'voucher', 'other'],
      message: 'Kategori hadiah tidak valid'
    },
    default: 'other'
  },
  brand: {
    type: String,
    trim: true,
    maxlength: [100, 'Brand maksimal 100 karakter']
  },
  model: {
    type: String,
    trim: true,
    maxlength: [100, 'Model maksimal 100 karakter']
  },
  specifications: {
    type: Map,
    of: String,
    default: new Map()
  },
  condition: {
    type: String,
    enum: ['new', 'like_new', 'good', 'fair'],
    default: 'new'
  },
  claimInstructions: {
    type: String,
    required: [true, 'Instruksi klaim hadiah wajib diisi'],
    maxlength: [2000, 'Instruksi klaim maksimal 2000 karakter']
  },
  claimDeadline: {
    type: Number,
    default: 30, // days
    min: [1, 'Batas waktu klaim minimal 1 hari'],
    max: [365, 'Batas waktu klaim maksimal 365 hari']
  },
  isPhysical: {
    type: Boolean,
    default: true
  },
  shippingRequired: {
    type: Boolean,
    default: true
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: [0, 'Biaya pengiriman tidak boleh negatif']
  },
  weight: {
    type: Number, // in grams
    min: [0, 'Berat tidak boleh negatif']
  },
  dimensions: {
    length: {
      type: Number,
      min: [0, 'Panjang tidak boleh negatif']
    },
    width: {
      type: Number,
      min: [0, 'Lebar tidak boleh negatif']
    },
    height: {
      type: Number,
      min: [0, 'Tinggi tidak boleh negatif']
    }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag maksimal 50 karakter']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  winners: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket'
    },
    wonAt: {
      type: Date,
      default: Date.now
    },
    claimStatus: {
      type: String,
      enum: ['pending', 'claimed', 'expired', 'cancelled'],
      default: 'pending'
    },
    claimedAt: {
      type: Date,
      default: null
    },
    claimDeadlineDate: {
      type: Date
    },
    shippingInfo: {
      address: {
        street: String,
        city: String,
        province: String,
        postalCode: String,
        country: String
      },
      trackingNumber: String,
      shippedAt: Date,
      deliveredAt: Date,
      courier: String
    },
    notes: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
prizeSchema.index({ raffle: 1, position: 1 });
prizeSchema.index({ raffle: 1, isActive: 1 });
prizeSchema.index({ category: 1 });
prizeSchema.index({ value: -1 });
prizeSchema.index({ 'winners.user': 1 });
prizeSchema.index({ 'winners.claimStatus': 1 });

// Compound index for raffle and position (unique)
prizeSchema.index({ raffle: 1, position: 1 }, { unique: true });

// Virtual for remaining quantity
prizeSchema.virtual('remainingQuantity').get(function() {
  const wonCount = this.winners.filter(w => w.claimStatus !== 'cancelled').length;
  return this.quantity - wonCount;
});

// Virtual for is available
prizeSchema.virtual('isAvailable').get(function() {
  return this.isActive && this.remainingQuantity > 0;
});

// Virtual for total claimed
prizeSchema.virtual('totalClaimed').get(function() {
  return this.winners.filter(w => w.claimStatus === 'claimed').length;
});

// Virtual for total pending claims
prizeSchema.virtual('totalPendingClaims').get(function() {
  return this.winners.filter(w => w.claimStatus === 'pending').length;
});

// Virtual for formatted value
prizeSchema.virtual('formattedValue').get(function() {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(this.value);
});

// Pre-save middleware
prizeSchema.pre('save', function(next) {
  // Set claim deadline for new winners
  this.winners.forEach(winner => {
    if (winner.isNew && !winner.claimDeadlineDate) {
      winner.claimDeadlineDate = new Date(Date.now() + this.claimDeadline * 24 * 60 * 60 * 1000);
    }
  });
  
  next();
});

// Method to add winner
prizeSchema.methods.addWinner = function(userId, ticketId) {
  if (this.remainingQuantity <= 0) {
    throw new Error('Hadiah sudah habis');
  }
  
  // Check if user already won this prize
  const existingWinner = this.winners.find(w => 
    w.user.toString() === userId.toString() && 
    w.claimStatus !== 'cancelled'
  );
  
  if (existingWinner) {
    throw new Error('Pengguna sudah memenangkan hadiah ini');
  }
  
  const claimDeadlineDate = new Date(Date.now() + this.claimDeadline * 24 * 60 * 60 * 1000);
  
  this.winners.push({
    user: userId,
    ticket: ticketId,
    wonAt: new Date(),
    claimDeadlineDate: claimDeadlineDate
  });
  
  return this.save();
};

// Method to claim prize
prizeSchema.methods.claimPrize = function(userId, shippingInfo = null) {
  const winner = this.winners.find(w => 
    w.user.toString() === userId.toString() && 
    w.claimStatus === 'pending'
  );
  
  if (!winner) {
    throw new Error('Pemenang tidak ditemukan atau hadiah sudah diklaim');
  }
  
  if (new Date() > winner.claimDeadlineDate) {
    winner.claimStatus = 'expired';
    throw new Error('Batas waktu klaim hadiah sudah habis');
  }
  
  winner.claimStatus = 'claimed';
  winner.claimedAt = new Date();
  
  if (this.shippingRequired && shippingInfo) {
    winner.shippingInfo.address = shippingInfo;
  }
  
  return this.save();
};

// Method to update shipping info
prizeSchema.methods.updateShipping = function(userId, trackingNumber, courier) {
  const winner = this.winners.find(w => 
    w.user.toString() === userId.toString() && 
    w.claimStatus === 'claimed'
  );
  
  if (!winner) {
    throw new Error('Pemenang tidak ditemukan atau hadiah belum diklaim');
  }
  
  winner.shippingInfo.trackingNumber = trackingNumber;
  winner.shippingInfo.courier = courier;
  winner.shippingInfo.shippedAt = new Date();
  
  return this.save();
};

// Method to mark as delivered
prizeSchema.methods.markAsDelivered = function(userId) {
  const winner = this.winners.find(w => 
    w.user.toString() === userId.toString() && 
    w.claimStatus === 'claimed'
  );
  
  if (!winner) {
    throw new Error('Pemenang tidak ditemukan atau hadiah belum diklaim');
  }
  
  winner.shippingInfo.deliveredAt = new Date();
  
  return this.save();
};

// Static method to find by raffle
prizeSchema.statics.findByRaffle = function(raffleId) {
  return this.find({ raffle: raffleId, isActive: true })
    .sort({ position: 1 })
    .populate('raffle', 'title status')
    .populate('winners.user', 'fullName whatsappNumber')
    .populate('winners.ticket', 'ticketNumber');
};

// Static method to find prizes with pending claims
prizeSchema.statics.findPendingClaims = function() {
  return this.find({
    'winners.claimStatus': 'pending',
    'winners.claimDeadlineDate': { $gte: new Date() }
  }).populate('raffle', 'title')
    .populate('winners.user', 'fullName whatsappNumber');
};

// Static method to find expired claims
prizeSchema.statics.findExpiredClaims = function() {
  return this.find({
    'winners.claimStatus': 'pending',
    'winners.claimDeadlineDate': { $lt: new Date() }
  });
};

module.exports = mongoose.model('Prize', prizeSchema);