const mongoose = require('mongoose');

const raffleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Judul undian wajib diisi'],
    trim: true,
    maxlength: [200, 'Judul undian maksimal 200 karakter']
  },
  description: {
    type: String,
    required: [true, 'Deskripsi undian wajib diisi'],
    trim: true,
    maxlength: [2000, 'Deskripsi undian maksimal 2000 karakter']
  },
  ticketPrice: {
    type: Number,
    required: [true, 'Harga tiket wajib diisi'],
    min: [1000, 'Harga tiket minimal Rp 1.000'],
    max: [10000000, 'Harga tiket maksimal Rp 10.000.000']
  },
  maxTickets: {
    type: Number,
    required: [true, 'Jumlah maksimal tiket wajib diisi'],
    min: [10, 'Minimal 10 tiket per undian'],
    max: [100000, 'Maksimal 100.000 tiket per undian']
  },
  ticketsSold: {
    type: Number,
    default: 0,
    min: [0, 'Tiket terjual tidak boleh negatif']
  },
  startDate: {
    type: Date,
    required: [true, 'Tanggal mulai wajib diisi'],
    validate: {
      validator: function(v) {
        return v >= new Date();
      },
      message: 'Tanggal mulai tidak boleh di masa lalu'
    }
  },
  endDate: {
    type: Date,
    required: [true, 'Tanggal berakhir wajib diisi'],
    validate: {
      validator: function(v) {
        return v > this.startDate;
      },
      message: 'Tanggal berakhir harus setelah tanggal mulai'
    }
  },
  drawDate: {
    type: Date,
    required: [true, 'Tanggal pengundian wajib diisi'],
    validate: {
      validator: function(v) {
        return v >= this.endDate;
      },
      message: 'Tanggal pengundian harus setelah atau sama dengan tanggal berakhir'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'active', 'ended', 'drawn', 'cancelled'],
      message: 'Status undian tidak valid'
    },
    default: 'draft'
  },
  featuredImage: {
    type: String,
    required: [true, 'Gambar utama undian wajib diisi']
  },
  gallery: [{
    type: String
  }],
  backgroundVideo: {
    type: String,
    default: null
  },
  terms: {
    type: String,
    required: [true, 'Syarat dan ketentuan wajib diisi'],
    maxlength: [5000, 'Syarat dan ketentuan maksimal 5000 karakter']
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['electronics', 'automotive', 'fashion', 'home', 'travel', 'cash', 'other'],
    default: 'other'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag maksimal 50 karakter']
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  drawResults: {
    isDrawn: {
      type: Boolean,
      default: false
    },
    drawnAt: {
      type: Date,
      default: null
    },
    drawnBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    drawId: {
      type: String,
      default: null
    },
    algorithm: {
      type: String,
      default: 'crypto-random'
    },
    seed: {
      type: String,
      default: null
    }
  },
  statistics: {
    totalRevenue: {
      type: Number,
      default: 0
    },
    uniqueParticipants: {
      type: Number,
      default: 0
    },
    averageTicketsPerUser: {
      type: Number,
      default: 0
    }
  },
  notifications: {
    reminderSent: {
      type: Boolean,
      default: false
    },
    resultsSent: {
      type: Boolean,
      default: false
    },
    endingSoonSent: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
raffleSchema.index({ status: 1 });
raffleSchema.index({ startDate: 1, endDate: 1 });
raffleSchema.index({ drawDate: 1 });
raffleSchema.index({ isPublished: 1 });
raffleSchema.index({ isFeatured: 1 });
raffleSchema.index({ category: 1 });
raffleSchema.index({ createdBy: 1 });
raffleSchema.index({ 'drawResults.isDrawn': 1 });

// Virtual for remaining tickets
raffleSchema.virtual('remainingTickets').get(function() {
  return this.maxTickets - this.ticketsSold;
});

// Virtual for sold percentage
raffleSchema.virtual('soldPercentage').get(function() {
  return Math.round((this.ticketsSold / this.maxTickets) * 100);
});

// Virtual for time remaining
raffleSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const end = new Date(this.endDate);
  const diff = end - now;
  
  if (diff <= 0) return null;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes, total: diff };
});

// Virtual for is active
raffleSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.startDate <= now && 
         this.endDate > now && 
         this.ticketsSold < this.maxTickets;
});

// Virtual for can purchase
raffleSchema.virtual('canPurchase').get(function() {
  return this.isActive && this.remainingTickets > 0;
});

// Virtual for prizes count
raffleSchema.virtual('prizesCount', {
  ref: 'Prize',
  localField: '_id',
  foreignField: 'raffle',
  count: true
});

// Virtual for tickets count
raffleSchema.virtual('ticketsCount', {
  ref: 'Ticket',
  localField: '_id',
  foreignField: 'raffle',
  count: true
});

// Pre-save middleware
raffleSchema.pre('save', function(next) {
  // Auto-update status based on dates
  const now = new Date();
  
  if (this.status === 'active') {
    if (now < this.startDate) {
      this.status = 'draft';
    } else if (now >= this.endDate || this.ticketsSold >= this.maxTickets) {
      this.status = 'ended';
    }
  }
  
  // Update statistics
  this.statistics.totalRevenue = this.ticketsSold * this.ticketPrice;
  
  next();
});

// Method to check if raffle can be drawn
raffleSchema.methods.canDraw = function() {
  const now = new Date();
  return this.status === 'ended' && 
         now >= this.drawDate && 
         !this.drawResults.isDrawn &&
         this.ticketsSold > 0;
};

// Method to activate raffle
raffleSchema.methods.activate = function() {
  if (this.status !== 'draft') {
    throw new Error('Hanya undian dengan status draft yang dapat diaktifkan');
  }
  
  const now = new Date();
  if (this.startDate <= now) {
    this.status = 'active';
  }
  
  this.isPublished = true;
  return this.save();
};

// Method to end raffle
raffleSchema.methods.endRaffle = function() {
  if (this.status !== 'active') {
    throw new Error('Hanya undian aktif yang dapat diakhiri');
  }
  
  this.status = 'ended';
  return this.save();
};

// Method to cancel raffle
raffleSchema.methods.cancelRaffle = function(reason) {
  if (['drawn', 'cancelled'].includes(this.status)) {
    throw new Error('Undian tidak dapat dibatalkan');
  }
  
  this.status = 'cancelled';
  this.cancelReason = reason;
  return this.save();
};

// Static method to find active raffles
raffleSchema.statics.findActive = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    isPublished: true,
    startDate: { $lte: now },
    endDate: { $gt: now }
  }).populate('createdBy', 'fullName');
};

// Static method to find raffles ready for draw
raffleSchema.statics.findReadyForDraw = function() {
  const now = new Date();
  return this.find({
    status: 'ended',
    drawDate: { $lte: now },
    'drawResults.isDrawn': false,
    ticketsSold: { $gt: 0 }
  });
};

// Static method to find featured raffles
raffleSchema.statics.findFeatured = function() {
  return this.find({
    isFeatured: true,
    isPublished: true,
    status: { $in: ['active', 'ended'] }
  }).sort({ createdAt: -1 }).limit(5);
};

module.exports = mongoose.model('Raffle', raffleSchema);