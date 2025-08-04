# Build stage - Pin to specific version and update packages
FROM node:20.19.4-alpine3.22 AS builder

# Accept build arg for NODE_ENV
ARG NODE_ENV=production

# Update Alpine packages and install build dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache python3 make g++ && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
# Skip prepare script since we haven't copied source code yet
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20.19.4-alpine3.22 AS production

# Update packages and install dumb-init for proper signal handling
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy necessary config files
COPY --chown=nodejs:nodejs .env.example .env.example
COPY --chown=nodejs:nodejs config ./config

# Create directories for cache and logs with proper permissions
RUN mkdir -p /app/cache /app/logs && \
    chown -R nodejs:nodejs /app/cache /app/logs

# Switch to non-root user
USER nodejs

# Expose port (informational)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]