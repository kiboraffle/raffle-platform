// MongoDB initialization script
// This script runs when MongoDB container starts for the first time

// Switch to the raffle_platform database
db = db.getSiblingDB('raffle_platform');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['whatsappNumber', 'password', 'fullName'],
      properties: {
        whatsappNumber: {
          bsonType: 'string',
          pattern: '^(\\+62|62|0)8[1-9][0-9]{6,9}$',
          description: 'WhatsApp number must be a valid Indonesian phone number'
        },
        password: {
          bsonType: 'string',
          minLength: 6,
          description: 'Password must be at least 6 characters'
        },
        fullName: {
          bsonType: 'string',
          minLength: 2,
          maxLength: 100,
          description: 'Full name must be between 2-100 characters'
        },
        email: {
          bsonType: ['string', 'null'],
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
          description: 'Email must be valid format'
        },
        role: {
          bsonType: 'string',
          enum: ['user', 'admin'],
          description: 'Role must be either user or admin'
        },
        isVerified: {
          bsonType: 'bool',
          description: 'Verification status must be boolean'
        },
        isActive: {
          bsonType: 'bool',
          description: 'Active status must be boolean'
        }
      }
    }
  }
});

db.createCollection('raffles', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'description', 'ticketPrice', 'maxTickets', 'startDate', 'endDate', 'drawDate'],
      properties: {
        title: {
          bsonType: 'string',
          minLength: 5,
          maxLength: 200,
          description: 'Title must be between 5-200 characters'
        },
        ticketPrice: {
          bsonType: 'number',
          minimum: 1000,
          maximum: 10000000,
          description: 'Ticket price must be between 1000-10000000'
        },
        maxTickets: {
          bsonType: 'number',
          minimum: 10,
          maximum: 100000,
          description: 'Max tickets must be between 10-100000'
        },
        status: {
          bsonType: 'string',
          enum: ['draft', 'active', 'ended', 'drawn', 'cancelled'],
          description: 'Status must be valid raffle status'
        }
      }
    }
  }
});

db.createCollection('prizes');
db.createCollection('tickets');
db.createCollection('payments');

// Create indexes for better performance

// Users indexes
db.users.createIndex({ whatsappNumber: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ isVerified: 1 });
db.users.createIndex({ isActive: 1 });
db.users.createIndex({ role: 1 });
db.users.createIndex({ createdAt: -1 });

// Raffles indexes
db.raffles.createIndex({ status: 1 });
db.raffles.createIndex({ startDate: 1, endDate: 1 });
db.raffles.createIndex({ drawDate: 1 });
db.raffles.createIndex({ isPublished: 1 });
db.raffles.createIndex({ isFeatured: 1 });
db.raffles.createIndex({ category: 1 });
db.raffles.createIndex({ createdBy: 1 });
db.raffles.createIndex({ 'drawResults.isDrawn': 1 });
db.raffles.createIndex({ createdAt: -1 });

// Prizes indexes
db.prizes.createIndex({ raffle: 1, position: 1 }, { unique: true });
db.prizes.createIndex({ raffle: 1, isActive: 1 });
db.prizes.createIndex({ category: 1 });
db.prizes.createIndex({ value: -1 });
db.prizes.createIndex({ 'winners.user': 1 });
db.prizes.createIndex({ 'winners.claimStatus': 1 });

// Tickets indexes
db.tickets.createIndex({ ticketNumber: 1 }, { unique: true });
db.tickets.createIndex({ barcode: 1 }, { unique: true });
db.tickets.createIndex({ raffle: 1, user: 1 });
db.tickets.createIndex({ status: 1 });
db.tickets.createIndex({ isWinner: 1 });
db.tickets.createIndex({ purchaseDate: -1 });
db.tickets.createIndex({ expiresAt: 1 });
db.tickets.createIndex({ claimStatus: 1 });

// Payments indexes
db.payments.createIndex({ paymentId: 1 }, { unique: true });
db.payments.createIndex({ user: 1, status: 1 });
db.payments.createIndex({ raffle: 1, status: 1 });
db.payments.createIndex({ status: 1, createdAt: -1 });
db.payments.createIndex({ gatewayTransactionId: 1 });
db.payments.createIndex({ gatewayOrderId: 1 });
db.payments.createIndex({ expiresAt: 1 });
db.payments.createIndex({ paidAt: -1 });
db.payments.createIndex({ paymentMethod: 1 });
db.payments.createIndex({ gatewayProvider: 1 });

// Create default admin user
const bcrypt = require('bcryptjs');
const adminPassword = 'admin123'; // Change this in production

// Note: In real deployment, hash the password properly
db.users.insertOne({
  whatsappNumber: '+6281234567890',
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', // admin123
  fullName: 'Administrator',
  email: 'admin@raffleplatform.com',
  role: 'admin',
  isVerified: true,
  isActive: true,
  totalTicketsPurchased: 0,
  totalAmountSpent: 0,
  totalWins: 0,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Create sample raffle categories
db.categories.insertMany([
  { code: 'electronics', name: 'Elektronik', icon: '📱', isActive: true },
  { code: 'automotive', name: 'Otomotif', icon: '🚗', isActive: true },
  { code: 'fashion', name: 'Fashion', icon: '👕', isActive: true },
  { code: 'home', name: 'Rumah Tangga', icon: '🏠', isActive: true },
  { code: 'travel', name: 'Travel', icon: '✈️', isActive: true },
  { code: 'cash', name: 'Uang Tunai', icon: '💰', isActive: true },
  { code: 'other', name: 'Lainnya', icon: '🎁', isActive: true }
]);

print('✅ Database initialization completed successfully!');
print('📊 Collections created: users, raffles, prizes, tickets, payments');
print('🔍 Indexes created for optimal performance');
print('👤 Default admin user created');
print('📱 Admin WhatsApp: +6281234567890');
print('🔑 Admin Password: admin123');
print('⚠️  Please change the admin password in production!');