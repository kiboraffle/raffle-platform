# Multi-stage build for production
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/profiles uploads/raffles uploads/prizes

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 5000

# Start development server
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p uploads/profiles uploads/raffles uploads/prizes logs

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start production server
CMD ["npm", "start"]