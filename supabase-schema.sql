-- Supabase Database Schema for Raffle Platform
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  date_of_birth DATE,
  address JSONB DEFAULT '{}',
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  profile_picture TEXT,
  last_login TIMESTAMP WITH TIME ZONE,
  login_attempts INTEGER DEFAULT 0,
  lock_until TIMESTAMP WITH TIME ZONE,
  reset_password_token TEXT,
  reset_password_expires TIMESTAMP WITH TIME ZONE,
  otp_code VARCHAR(10),
  otp_expires TIMESTAMP WITH TIME ZONE,
  total_tickets_purchased INTEGER DEFAULT 0,
  total_amount_spent DECIMAL(15,2) DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raffles table
CREATE TABLE IF NOT EXISTS raffles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  ticket_price DECIMAL(10,2) NOT NULL CHECK (ticket_price >= 1000),
  max_tickets INTEGER NOT NULL CHECK (max_tickets >= 10),
  tickets_sold INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  draw_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended', 'drawn', 'cancelled')),
  featured_image TEXT NOT NULL,
  gallery TEXT[] DEFAULT '{}',
  background_video TEXT,
  terms TEXT NOT NULL,
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  category VARCHAR(50) DEFAULT 'other',
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  draw_results JSONB DEFAULT '{}',
  statistics JSONB DEFAULT '{"totalRevenue": 0, "uniqueParticipants": 0, "averageTicketsPerUser": 0}',
  notifications JSONB DEFAULT '{"reminderSent": false, "resultsSent": false, "endingSoonSent": false}',
  cancel_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (start_date < end_date AND end_date <= draw_date)
);

-- Prizes table
CREATE TABLE IF NOT EXISTS prizes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  value DECIMAL(15,2) NOT NULL CHECK (value >= 0),
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  position INTEGER NOT NULL CHECK (position >= 1),
  image TEXT NOT NULL,
  gallery TEXT[] DEFAULT '{}',
  category VARCHAR(50) DEFAULT 'other',
  brand VARCHAR(100),
  model VARCHAR(100),
  specifications JSONB DEFAULT '{}',
  condition VARCHAR(20) DEFAULT 'new' CHECK (condition IN ('new', 'like_new', 'good', 'fair')),
  claim_instructions TEXT NOT NULL,
  claim_deadline INTEGER DEFAULT 30 CHECK (claim_deadline BETWEEN 1 AND 365),
  is_physical BOOLEAN DEFAULT true,
  shipping_required BOOLEAN DEFAULT true,
  shipping_cost DECIMAL(10,2) DEFAULT 0 CHECK (shipping_cost >= 0),
  weight DECIMAL(8,2) CHECK (weight >= 0),
  dimensions JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  winners JSONB[] DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(raffle_id, position)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  payment_id VARCHAR(100) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 1000),
  ticket_quantity INTEGER NOT NULL CHECK (ticket_quantity >= 1),
  ticket_price DECIMAL(10,2) NOT NULL CHECK (ticket_price >= 1000),
  admin_fee DECIMAL(10,2) DEFAULT 0 CHECK (admin_fee >= 0),
  total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount >= 1000),
  currency VARCHAR(3) DEFAULT 'IDR',
  payment_method VARCHAR(50) NOT NULL,
  payment_channel VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'expired', 'refunded', 'partial_refund')),
  gateway_provider VARCHAR(50) NOT NULL,
  gateway_transaction_id VARCHAR(255),
  gateway_order_id VARCHAR(255),
  gateway_response JSONB DEFAULT '{}',
  payment_url TEXT,
  qr_code_url TEXT,
  virtual_account_number VARCHAR(50),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_amount DECIMAL(15,2) DEFAULT 0 CHECK (refund_amount >= 0),
  refund_reason TEXT,
  customer_info JSONB NOT NULL,
  billing_address JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  notifications JSONB DEFAULT '{"webhookReceived": false, "userNotified": false, "adminNotified": false, "whatsappSent": false}',
  webhook_history JSONB[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 1000),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 1000),
  barcode VARCHAR(255) UNIQUE NOT NULL,
  qr_code TEXT NOT NULL,
  verification_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'used', 'expired', 'cancelled')),
  is_winner BOOLEAN DEFAULT false,
  prize_won_id UUID REFERENCES prizes(id) ON DELETE SET NULL,
  winning_position INTEGER,
  won_at TIMESTAMP WITH TIME ZONE,
  claim_status VARCHAR(20) DEFAULT 'not_applicable' CHECK (claim_status IN ('not_applicable', 'pending', 'claimed', 'expired')),
  claimed_at TIMESTAMP WITH TIME ZONE,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}',
  verification_history JSONB[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verified_active ON users(is_verified, is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_raffles_status ON raffles(status);
CREATE INDEX IF NOT EXISTS idx_raffles_published ON raffles(is_published);
CREATE INDEX IF NOT EXISTS idx_raffles_featured ON raffles(is_featured);
CREATE INDEX IF NOT EXISTS idx_raffles_dates ON raffles(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_raffles_draw_date ON raffles(draw_date);
CREATE INDEX IF NOT EXISTS idx_raffles_category ON raffles(category);
CREATE INDEX IF NOT EXISTS idx_raffles_created_by ON raffles(created_by);

CREATE INDEX IF NOT EXISTS idx_prizes_raffle ON prizes(raffle_id);
CREATE INDEX IF NOT EXISTS idx_prizes_active ON prizes(is_active);
CREATE INDEX IF NOT EXISTS idx_prizes_position ON prizes(raffle_id, position);
CREATE INDEX IF NOT EXISTS idx_prizes_category ON prizes(category);
CREATE INDEX IF NOT EXISTS idx_prizes_value ON prizes(value DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_raffle_user ON tickets(raffle_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_barcode ON tickets(barcode);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_winner ON tickets(is_winner);
CREATE INDEX IF NOT EXISTS idx_tickets_purchase_date ON tickets(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_expires_at ON tickets(expires_at);
CREATE INDEX IF NOT EXISTS idx_tickets_claim_status ON tickets(claim_status);

CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_raffle_status ON payments(raffle_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_tx ON payments(gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order ON payments(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_expires_at ON payments(expires_at);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(gateway_provider);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_raffles_updated_at BEFORE UPDATE ON raffles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prizes_updated_at BEFORE UPDATE ON prizes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
INSERT INTO users (
  whatsapp_number,
  password,
  full_name,
  email,
  role,
  is_verified,
  is_active
) VALUES (
  '+6281234567890',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G',
  'Administrator',
  'admin@raffleplatform.com',
  'admin',
  true,
  true
) ON CONFLICT (whatsapp_number) DO NOTHING;

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Admins can view all users" ON users FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));
CREATE POLICY "Admins can update all users" ON users FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Raffles policies
CREATE POLICY "Anyone can view published raffles" ON raffles FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can view all raffles" ON raffles FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));
CREATE POLICY "Admins can manage raffles" ON raffles FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Prizes policies
CREATE POLICY "Anyone can view active prizes" ON prizes FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage prizes" ON prizes FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Tickets policies
CREATE POLICY "Users can view their own tickets" ON tickets FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own tickets" ON tickets FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Admins can view all tickets" ON tickets FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));
CREATE POLICY "Admins can manage tickets" ON tickets FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Payments policies
CREATE POLICY "Users can view their own payments" ON payments FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own payments" ON payments FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Admins can view all payments" ON payments FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));
CREATE POLICY "Admins can manage payments" ON payments FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

COMMIT;