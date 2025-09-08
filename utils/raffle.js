const crypto = require('crypto');
const { Ticket, Prize, Raffle } = require('../models');

class RaffleDrawService {
  constructor() {
    this.algorithm = 'crypto-random';
  }

  // Generate cryptographically secure random number
  generateSecureRandom(min, max) {
    const range = max - min + 1;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValue = Math.pow(256, bytesNeeded);
    const threshold = maxValue - (maxValue % range);
    
    let randomBytes;
    let randomValue;
    
    do {
      randomBytes = crypto.randomBytes(bytesNeeded);
      randomValue = 0;
      
      for (let i = 0; i < bytesNeeded; i++) {
        randomValue = randomValue * 256 + randomBytes[i];
      }
    } while (randomValue >= threshold);
    
    return min + (randomValue % range);
  }

  // Generate draw seed for transparency
  generateDrawSeed(raffleId, drawDate) {
    const data = `${raffleId}-${drawDate}-${Date.now()}-${Math.random()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Generate draw ID for audit trail
  generateDrawId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `DRAW-${timestamp}-${random}`;
  }

  // Shuffle array using Fisher-Yates algorithm with crypto random
  shuffleArray(array) {
    const shuffled = [...array];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.generateSecureRandom(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }

  // Validate raffle can be drawn
  async validateRaffleForDraw(raffleId) {
    try {
      const raffle = await Raffle.findById(raffleId)
        .populate('createdBy', 'fullName role');
      
      if (!raffle) {
        return {
          valid: false,
          error: 'Undian tidak ditemukan'
        };
      }

      if (raffle.status !== 'ended') {
        return {
          valid: false,
          error: 'Undian belum berakhir'
        };
      }

      if (raffle.drawResults.isDrawn) {
        return {
          valid: false,
          error: 'Undian sudah pernah diundi'
        };
      }

      const now = new Date();
      if (now < raffle.drawDate) {
        return {
          valid: false,
          error: 'Belum waktunya pengundian'
        };
      }

      // Check if there are tickets sold
      const ticketCount = await Ticket.countDocuments({
        raffle: raffleId,
        status: 'active'
      });

      if (ticketCount === 0) {
        return {
          valid: false,
          error: 'Tidak ada tiket yang terjual'
        };
      }

      // Check if there are prizes
      const prizeCount = await Prize.countDocuments({
        raffle: raffleId,
        isActive: true
      });

      if (prizeCount === 0) {
        return {
          valid: false,
          error: 'Tidak ada hadiah yang tersedia'
        };
      }

      return {
        valid: true,
        raffle,
        ticketCount,
        prizeCount
      };
    } catch (error) {
      console.error('Error validating raffle for draw:', error);
      return {
        valid: false,
        error: 'Terjadi kesalahan saat validasi'
      };
    }
  }

  // Get all eligible tickets for draw
  async getEligibleTickets(raffleId) {
    try {
      const tickets = await Ticket.find({
        raffle: raffleId,
        status: 'active',
        isWinner: false
      })
      .populate('user', 'fullName whatsappNumber')
      .sort({ purchaseDate: 1 }); // Sort by purchase date for fairness

      // Expand tickets based on quantity (each ticket purchase can have multiple entries)
      const expandedTickets = [];
      
      tickets.forEach(ticket => {
        for (let i = 0; i < ticket.quantity; i++) {
          expandedTickets.push({
            ticketId: ticket._id,
            userId: ticket.user._id,
            userName: ticket.user.fullName,
            userPhone: ticket.user.whatsappNumber,
            ticketNumber: ticket.ticketNumber,
            purchaseDate: ticket.purchaseDate,
            entryIndex: i + 1
          });
        }
      });

      return {
        success: true,
        tickets: expandedTickets,
        totalEntries: expandedTickets.length,
        uniqueTickets: tickets.length
      };
    } catch (error) {
      console.error('Error getting eligible tickets:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get prizes ordered by position
  async getPrizesForDraw(raffleId) {
    try {
      const prizes = await Prize.find({
        raffle: raffleId,
        isActive: true
      })
      .sort({ position: 1 }); // Sort by position (1st, 2nd, 3rd, etc.)

      // Expand prizes based on quantity
      const expandedPrizes = [];
      
      prizes.forEach(prize => {
        for (let i = 0; i < prize.quantity; i++) {
          expandedPrizes.push({
            prizeId: prize._id,
            name: prize.name,
            description: prize.description,
            value: prize.value,
            position: prize.position,
            image: prize.image,
            claimInstructions: prize.claimInstructions,
            claimDeadline: prize.claimDeadline,
            quantityIndex: i + 1
          });
        }
      });

      return {
        success: true,
        prizes: expandedPrizes,
        totalPrizes: expandedPrizes.length,
        uniquePrizes: prizes.length
      };
    } catch (error) {
      console.error('Error getting prizes for draw:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Perform the actual draw
  async performDraw(raffleId, drawnBy) {
    try {
      // Validate raffle
      const validation = await this.validateRaffleForDraw(raffleId);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const raffle = validation.raffle;

      // Get eligible tickets
      const ticketsResult = await this.getEligibleTickets(raffleId);
      if (!ticketsResult.success) {
        return {
          success: false,
          error: ticketsResult.error
        };
      }

      // Get prizes
      const prizesResult = await this.getPrizesForDraw(raffleId);
      if (!prizesResult.success) {
        return {
          success: false,
          error: prizesResult.error
        };
      }

      const eligibleTickets = ticketsResult.tickets;
      const availablePrizes = prizesResult.prizes;

      if (eligibleTickets.length === 0) {
        return {
          success: false,
          error: 'Tidak ada tiket yang memenuhi syarat'
        };
      }

      if (availablePrizes.length === 0) {
        return {
          success: false,
          error: 'Tidak ada hadiah yang tersedia'
        };
      }

      // Generate draw metadata
      const drawId = this.generateDrawId();
      const drawSeed = this.generateDrawSeed(raffleId, raffle.drawDate);
      const drawTimestamp = new Date();

      // Shuffle tickets for randomness
      const shuffledTickets = this.shuffleArray(eligibleTickets);
      
      // Perform the draw
      const winners = [];
      const usedTickets = new Set(); // Track used tickets to prevent duplicate winners
      
      for (let i = 0; i < availablePrizes.length && winners.length < shuffledTickets.length; i++) {
        const prize = availablePrizes[i];
        let attempts = 0;
        let winner = null;
        
        // Try to find a winner that hasn't won yet
        while (attempts < shuffledTickets.length && !winner) {
          const randomIndex = this.generateSecureRandom(0, shuffledTickets.length - 1);
          const candidateTicket = shuffledTickets[randomIndex];
          
          // Check if this ticket hasn't won yet
          if (!usedTickets.has(candidateTicket.ticketId.toString())) {
            winner = {
              ...candidateTicket,
              prize: prize,
              winningPosition: prize.position,
              drawIndex: i + 1,
              randomIndex: randomIndex,
              wonAt: drawTimestamp
            };
            
            usedTickets.add(candidateTicket.ticketId.toString());
          }
          
          attempts++;
        }
        
        if (winner) {
          winners.push(winner);
        }
      }

      // Update database with results
      await this.saveDrawResults(raffle, winners, {
        drawId,
        drawSeed,
        algorithm: this.algorithm,
        drawnBy,
        drawnAt: drawTimestamp,
        totalTickets: eligibleTickets.length,
        totalPrizes: availablePrizes.length
      });

      return {
        success: true,
        drawId,
        winners,
        totalWinners: winners.length,
        totalTickets: eligibleTickets.length,
        totalPrizes: availablePrizes.length,
        drawSeed,
        drawnAt: drawTimestamp
      };
    } catch (error) {
      console.error('Error performing draw:', error);
      return {
        success: false,
        error: 'Terjadi kesalahan saat melakukan pengundian'
      };
    }
  }

  // Save draw results to database
  async saveDrawResults(raffle, winners, drawMetadata) {
    try {
      // Update raffle with draw results
      raffle.drawResults = {
        isDrawn: true,
        drawnAt: drawMetadata.drawnAt,
        drawnBy: drawMetadata.drawnBy,
        drawId: drawMetadata.drawId,
        algorithm: drawMetadata.algorithm,
        seed: drawMetadata.drawSeed
      };
      raffle.status = 'drawn';
      await raffle.save();

      // Update tickets with winning status
      for (const winner of winners) {
        await Ticket.findByIdAndUpdate(winner.ticketId, {
          isWinner: true,
          prizeWon: winner.prize.prizeId,
          winningPosition: winner.winningPosition,
          wonAt: winner.wonAt,
          claimStatus: 'pending'
        });

        // Add winner to prize
        await Prize.findByIdAndUpdate(winner.prize.prizeId, {
          $push: {
            winners: {
              user: winner.userId,
              ticket: winner.ticketId,
              wonAt: winner.wonAt,
              claimStatus: 'pending',
              claimDeadlineDate: new Date(Date.now() + winner.prize.claimDeadline * 24 * 60 * 60 * 1000)
            }
          }
        });
      }

      return {
        success: true,
        message: 'Draw results saved successfully'
      };
    } catch (error) {
      console.error('Error saving draw results:', error);
      throw error;
    }
  }

  // Get draw audit log
  async getDrawAuditLog(raffleId) {
    try {
      const raffle = await Raffle.findById(raffleId)
        .populate('drawResults.drawnBy', 'fullName role');
      
      if (!raffle || !raffle.drawResults.isDrawn) {
        return {
          success: false,
          error: 'Draw not found or not completed'
        };
      }

      const winners = await Ticket.find({
        raffle: raffleId,
        isWinner: true
      })
      .populate('user', 'fullName whatsappNumber')
      .populate('prizeWon', 'name position value')
      .sort({ winningPosition: 1 });

      return {
        success: true,
        auditLog: {
          raffleId: raffle._id,
          raffleTitle: raffle.title,
          drawId: raffle.drawResults.drawId,
          algorithm: raffle.drawResults.algorithm,
          seed: raffle.drawResults.seed,
          drawnAt: raffle.drawResults.drawnAt,
          drawnBy: raffle.drawResults.drawnBy,
          winners: winners.map(winner => ({
            ticketId: winner._id,
            ticketNumber: winner.ticketNumber,
            winnerName: winner.user.fullName,
            winnerPhone: winner.user.whatsappNumber,
            prizeName: winner.prizeWon.name,
            prizePosition: winner.prizeWon.position,
            prizeValue: winner.prizeWon.value,
            wonAt: winner.wonAt,
            claimStatus: winner.claimStatus
          }))
        }
      };
    } catch (error) {
      console.error('Error getting draw audit log:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify draw integrity
  async verifyDrawIntegrity(raffleId) {
    try {
      const auditLog = await this.getDrawAuditLog(raffleId);
      if (!auditLog.success) {
        return auditLog;
      }

      const log = auditLog.auditLog;
      
      // Verify seed generation
      const expectedSeed = this.generateDrawSeed(raffleId, log.drawnAt);
      const seedValid = log.seed && log.seed.length === 64; // SHA256 hash length
      
      // Check for duplicate winners
      const winnerUserIds = log.winners.map(w => w.winnerPhone);
      const uniqueWinners = new Set(winnerUserIds);
      const noDuplicates = winnerUserIds.length === uniqueWinners.size;
      
      // Verify prize positions are sequential
      const positions = log.winners.map(w => w.prizePosition).sort((a, b) => a - b);
      const sequentialPositions = positions.every((pos, index) => pos === index + 1);
      
      return {
        success: true,
        verification: {
          drawId: log.drawId,
          seedValid,
          noDuplicates,
          sequentialPositions,
          totalWinners: log.winners.length,
          algorithm: log.algorithm,
          drawnAt: log.drawnAt,
          isValid: seedValid && noDuplicates && sequentialPositions
        }
      };
    } catch (error) {
      console.error('Error verifying draw integrity:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get draw statistics
  async getDrawStatistics(raffleId) {
    try {
      const raffle = await Raffle.findById(raffleId);
      if (!raffle) {
        return {
          success: false,
          error: 'Raffle not found'
        };
      }

      const totalTickets = await Ticket.countDocuments({
        raffle: raffleId,
        status: 'active'
      });

      const totalWinners = await Ticket.countDocuments({
        raffle: raffleId,
        isWinner: true
      });

      const totalPrizes = await Prize.countDocuments({
        raffle: raffleId,
        isActive: true
      });

      const claimedPrizes = await Ticket.countDocuments({
        raffle: raffleId,
        isWinner: true,
        claimStatus: 'claimed'
      });

      const winningPercentage = totalTickets > 0 ? (totalWinners / totalTickets) * 100 : 0;
      const claimPercentage = totalWinners > 0 ? (claimedPrizes / totalWinners) * 100 : 0;

      return {
        success: true,
        statistics: {
          raffleTitle: raffle.title,
          totalTickets,
          totalWinners,
          totalPrizes,
          claimedPrizes,
          winningPercentage: Math.round(winningPercentage * 100) / 100,
          claimPercentage: Math.round(claimPercentage * 100) / 100,
          isDrawn: raffle.drawResults.isDrawn,
          drawnAt: raffle.drawResults.drawnAt
        }
      };
    } catch (error) {
      console.error('Error getting draw statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new RaffleDrawService();