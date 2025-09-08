const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class BarcodeService {
  constructor() {
    this.baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  // Generate unique barcode
  generateBarcode() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    const uuid = uuidv4().replace(/-/g, '').toUpperCase().substring(0, 8);
    
    return `RFL${timestamp}${random}${uuid}`;
  }

  // Generate ticket number
  generateTicketNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    
    return `TKT-${timestamp}-${random}`;
  }

  // Generate verification URL
  generateVerificationUrl(barcode) {
    return `${this.baseUrl}/verify/${barcode}`;
  }

  // Generate QR Code as Data URL
  async generateQRCode(data, options = {}) {
    try {
      const defaultOptions = {
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256,
        errorCorrectionLevel: 'M'
      };

      const qrOptions = { ...defaultOptions, ...options };
      const qrCodeDataURL = await QRCode.toDataURL(data, qrOptions);
      
      return {
        success: true,
        dataURL: qrCodeDataURL,
        data: data
      };
    } catch (error) {
      console.error('Error generating QR code:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate QR Code as Buffer
  async generateQRCodeBuffer(data, options = {}) {
    try {
      const defaultOptions = {
        type: 'png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256,
        errorCorrectionLevel: 'M'
      };

      const qrOptions = { ...defaultOptions, ...options };
      const qrCodeBuffer = await QRCode.toBuffer(data, qrOptions);
      
      return {
        success: true,
        buffer: qrCodeBuffer,
        data: data
      };
    } catch (error) {
      console.error('Error generating QR code buffer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate QR Code as SVG
  async generateQRCodeSVG(data, options = {}) {
    try {
      const defaultOptions = {
        type: 'svg',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256,
        errorCorrectionLevel: 'M'
      };

      const qrOptions = { ...defaultOptions, ...options };
      const qrCodeSVG = await QRCode.toString(data, qrOptions);
      
      return {
        success: true,
        svg: qrCodeSVG,
        data: data
      };
    } catch (error) {
      console.error('Error generating QR code SVG:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate ticket barcode with verification data
  async generateTicketBarcode(ticketData) {
    try {
      const {
        ticketId,
        userId,
        raffleId,
        ticketNumber,
        purchaseDate
      } = ticketData;

      // Generate unique barcode
      const barcode = this.generateBarcode();
      
      // Create verification URL
      const verificationUrl = this.generateVerificationUrl(barcode);
      
      // Create verification data object
      const verificationData = {
        barcode,
        ticketId,
        userId,
        raffleId,
        ticketNumber,
        purchaseDate: purchaseDate || new Date().toISOString(),
        verificationUrl,
        timestamp: Date.now()
      };

      // Generate QR code with verification URL
      const qrCodeResult = await this.generateQRCode(verificationUrl, {
        width: 200,
        margin: 2
      });

      if (!qrCodeResult.success) {
        throw new Error('Failed to generate QR code');
      }

      return {
        success: true,
        barcode,
        qrCode: qrCodeResult.dataURL,
        verificationUrl,
        verificationData
      };
    } catch (error) {
      console.error('Error generating ticket barcode:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate prize claim barcode
  async generatePrizeClaimBarcode(prizeData) {
    try {
      const {
        prizeId,
        winnerId,
        ticketId,
        raffleId,
        prizeName,
        claimInstructions
      } = prizeData;

      // Generate unique barcode for prize claim
      const claimBarcode = this.generateBarcode();
      
      // Create claim URL
      const claimUrl = `${this.baseUrl}/claim/${claimBarcode}`;
      
      // Create claim data object
      const claimData = {
        claimBarcode,
        prizeId,
        winnerId,
        ticketId,
        raffleId,
        prizeName,
        claimInstructions,
        claimUrl,
        timestamp: Date.now()
      };

      // Generate QR code with claim URL
      const qrCodeResult = await this.generateQRCode(claimUrl, {
        width: 250,
        margin: 2,
        color: {
          dark: '#2563eb', // Blue color for prize claim
          light: '#FFFFFF'
        }
      });

      if (!qrCodeResult.success) {
        throw new Error('Failed to generate claim QR code');
      }

      return {
        success: true,
        claimBarcode,
        qrCode: qrCodeResult.dataURL,
        claimUrl,
        claimData
      };
    } catch (error) {
      console.error('Error generating prize claim barcode:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Validate barcode format
  validateBarcodeFormat(barcode) {
    // Barcode should start with 'RFL' followed by alphanumeric characters
    const barcodeRegex = /^RFL[A-Z0-9]{32,}$/;
    return barcodeRegex.test(barcode);
  }

  // Extract information from barcode (if encoded)
  extractBarcodeInfo(barcode) {
    try {
      if (!this.validateBarcodeFormat(barcode)) {
        throw new Error('Invalid barcode format');
      }

      // Remove 'RFL' prefix
      const data = barcode.substring(3);
      
      // Extract timestamp (first 8 characters after RFL)
      const timestampHex = data.substring(0, 8);
      const timestamp = parseInt(timestampHex, 36);
      
      // Extract random part (next 16 characters)
      const randomPart = data.substring(8, 24);
      
      // Extract UUID part (remaining characters)
      const uuidPart = data.substring(24);

      return {
        success: true,
        timestamp: new Date(timestamp),
        randomPart,
        uuidPart,
        isValid: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isValid: false
      };
    }
  }

  // Generate batch barcodes for multiple tickets
  async generateBatchBarcodes(ticketsData) {
    try {
      const results = [];
      
      for (const ticketData of ticketsData) {
        const barcodeResult = await this.generateTicketBarcode(ticketData);
        
        if (barcodeResult.success) {
          results.push(barcodeResult);
        } else {
          console.error(`Failed to generate barcode for ticket ${ticketData.ticketId}:`, barcodeResult.error);
        }
      }

      return {
        success: true,
        results,
        totalGenerated: results.length,
        totalRequested: ticketsData.length
      };
    } catch (error) {
      console.error('Error generating batch barcodes:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate verification hash for additional security
  generateVerificationHash(data) {
    const secret = process.env.JWT_SECRET || 'default-secret';
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    return crypto
      .createHmac('sha256', secret)
      .update(dataString)
      .digest('hex');
  }

  // Verify hash
  verifyHash(data, hash) {
    const expectedHash = this.generateVerificationHash(data);
    return expectedHash === hash;
  }

  // Generate secure verification token
  generateVerificationToken(ticketData) {
    const payload = {
      ticketId: ticketData.ticketId,
      userId: ticketData.userId,
      raffleId: ticketData.raffleId,
      timestamp: Date.now()
    };

    const payloadString = JSON.stringify(payload);
    const hash = this.generateVerificationHash(payloadString);
    
    return {
      payload: Buffer.from(payloadString).toString('base64'),
      hash
    };
  }

  // Verify verification token
  verifyVerificationToken(token, hash) {
    try {
      const payloadString = Buffer.from(token, 'base64').toString('utf8');
      const payload = JSON.parse(payloadString);
      
      // Check if token is not too old (24 hours)
      const tokenAge = Date.now() - payload.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (tokenAge > maxAge) {
        return {
          success: false,
          error: 'Token expired',
          payload: null
        };
      }

      // Verify hash
      if (!this.verifyHash(payloadString, hash)) {
        return {
          success: false,
          error: 'Invalid token hash',
          payload: null
        };
      }

      return {
        success: true,
        payload
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid token format',
        payload: null
      };
    }
  }

  // Generate custom QR code with logo (if needed)
  async generateCustomQRCode(data, options = {}) {
    try {
      const {
        logo = null,
        backgroundColor = '#FFFFFF',
        foregroundColor = '#000000',
        size = 256,
        margin = 1
      } = options;

      const qrOptions = {
        type: 'image/png',
        quality: 0.92,
        margin,
        color: {
          dark: foregroundColor,
          light: backgroundColor
        },
        width: size,
        errorCorrectionLevel: 'H' // High error correction for logo overlay
      };

      const qrCodeDataURL = await QRCode.toDataURL(data, qrOptions);
      
      // If logo is provided, you can add logo overlay logic here
      // This would require additional image processing libraries like sharp or canvas
      
      return {
        success: true,
        dataURL: qrCodeDataURL,
        data: data
      };
    } catch (error) {
      console.error('Error generating custom QR code:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new BarcodeService();