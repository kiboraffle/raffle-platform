const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');

class User {
  constructor(userData) {
    Object.assign(this, userData);
  }

  // Validate WhatsApp number format
  static validateWhatsAppNumber(whatsappNumber) {
    return /^(\+62|62|0)8[1-9][0-9]{6,9}$/.test(whatsappNumber);
  }

  // Create new user
  static async create(userData) {
    if (!this.validateWhatsAppNumber(userData.whatsappNumber)) {
      throw new Error('Format nomor WhatsApp tidak valid');
    }

    const hashedPassword = await bcrypt.hash(userData.password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        whatsapp_number: userData.whatsappNumber,
        password: hashedPassword,
        full_name: userData.fullName,
        email: userData.email,
        date_of_birth: userData.dateOfBirth,
        address: userData.address || {}
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        if (error.message.includes('whatsapp_number')) {
          throw new Error('Nomor WhatsApp sudah terdaftar');
        }
        if (error.message.includes('email')) {
          throw new Error('Email sudah terdaftar');
        }
      }
      throw error;
    }
    
    return new User(data);
  }

  // Find user by WhatsApp number
  static async findByWhatsApp(whatsappNumber) {
    // Normalize the number for search
    let normalizedNumber = whatsappNumber.replace(/\D/g, '');
    
    if (normalizedNumber.startsWith('08')) {
      normalizedNumber = '62' + normalizedNumber.substring(1);
    } else if (normalizedNumber.startsWith('8')) {
      normalizedNumber = '62' + normalizedNumber;
    }
    
    const searchNumbers = [
      whatsappNumber,
      normalizedNumber,
      '+' + normalizedNumber,
      '0' + normalizedNumber.substring(2)
    ];

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .in('whatsapp_number', searchNumbers)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? new User(data) : null;
  }

  // Find user by ID
  static async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? new User(data) : null;
  }

  // Find user by email
  static async findByEmail(email) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? new User(data) : null;
  }

  // Update user
  async save() {
    const updateData = {
      full_name: this.full_name,
      email: this.email,
      date_of_birth: this.date_of_birth,
      address: this.address,
      is_verified: this.is_verified,
      is_active: this.is_active,
      profile_picture: this.profile_picture,
      last_login: this.last_login,
      login_attempts: this.login_attempts,
      lock_until: this.lock_until,
      reset_password_token: this.reset_password_token,
      reset_password_expires: this.reset_password_expires,
      otp_code: this.otp_code,
      otp_expires: this.otp_expires,
      total_tickets_purchased: this.total_tickets_purchased,
      total_amount_spent: this.total_amount_spent,
      total_wins: this.total_wins,
      notification_preferences: this.notification_preferences
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', this.id)
      .select()
      .single();

    if (error) throw error;
    Object.assign(this, data);
    return this;
  }

  // Update password
  async updatePassword(newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', this.id)
      .select()
      .single();

    if (error) throw error;
    Object.assign(this, data);
    return this;
  }

  // Compare password
  async comparePassword(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  }

  // Check if account is locked
  get isLocked() {
    return !!(this.lock_until && new Date(this.lock_until) > new Date());
  }

  // Increment login attempts
  async incLoginAttempts() {
    const updates = { login_attempts: (this.login_attempts || 0) + 1 };
    
    // Lock account after 5 failed attempts for 2 hours
    if (updates.login_attempts >= 5) {
      updates.lock_until = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    }
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', this.id)
      .select()
      .single();

    if (error) throw error;
    Object.assign(this, data);
    return this;
  }

  // Reset login attempts
  async resetLoginAttempts() {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        login_attempts: 0,
        lock_until: null
      })
      .eq('id', this.id)
      .select()
      .single();

    if (error) throw error;
    Object.assign(this, data);
    return this;
  }

  // Generate OTP
  generateOTP() {
    const otpLength = parseInt(process.env.OTP_LENGTH) || 6;
    const otp = Math.floor(Math.random() * Math.pow(10, otpLength)).toString().padStart(otpLength, '0');
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
    
    this.otp_code = otp;
    this.otp_expires = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    
    return otp;
  }

  // Verify OTP
  verifyOTP(otp) {
    return this.otp_code === otp && new Date(this.otp_expires) > new Date();
  }

  // Clear OTP
  clearOTP() {
    this.otp_code = null;
    this.otp_expires = null;
  }

  // Format WhatsApp number
  formatWhatsAppNumber() {
    let number = this.whatsapp_number;
    
    // Remove all non-digit characters
    number = number.replace(/\D/g, '');
    
    // Convert to international format
    if (number.startsWith('08')) {
      number = '62' + number.substring(1);
    } else if (number.startsWith('8')) {
      number = '62' + number;
    } else if (number.startsWith('0')) {
      number = '62' + number.substring(1);
    }
    
    return '+' + number;
  }

  // Static methods for queries
  static async findAll(options = {}) {
    let query = supabaseAdmin.from('users').select('*');
    
    if (options.where) {
      Object.keys(options.where).forEach(key => {
        query = query.eq(key, options.where[key]);
      });
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }
    
    if (options.orderBy) {
      query = query.order(options.orderBy.field, { ascending: options.orderBy.ascending !== false });
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data.map(user => new User(user));
  }

  static async count(where = {}) {
    let query = supabaseAdmin.from('users').select('*', { count: 'exact', head: true });
    
    Object.keys(where).forEach(key => {
      query = query.eq(key, where[key]);
    });
    
    const { count, error } = await query;
    
    if (error) throw error;
    return count;
  }

  // Delete user (soft delete)
  async delete() {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString()
      })
      .eq('id', this.id)
      .select()
      .single();

    if (error) throw error;
    Object.assign(this, data);
    return this;
  }

  // Convert to JSON (exclude sensitive data)
  toJSON() {
    const { password, otp_code, reset_password_token, ...publicData } = this;
    return publicData;
  }
}

module.exports = User;