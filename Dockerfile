# Stage 1: Builder
FROM node:23-alpine AS builder
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    git \
    curl

# Copy package files
COPY package*.json ./
COPY prisma/ ./prisma/

# Install dependencies
RUN npm ci && \
    npm install --save ts-node module-alias && \
    npm cache clean --force

# Copy project files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Production
FROM node:23-alpine AS app
WORKDIR /app

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Runtime setup
RUN addgroup -S hivepay && \
    adduser -S hivepay -G hivepay

COPY --from=builder --chown=hivepay:hivepay /app .

USER hivepay
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "bootstrap.js"]

# Stage 3: Monitor
FROM node:23-alpine AS monitor
WORKDIR /app

# Install tini for proper signal handling
RUN apk add --no-cache tini curl

# Runtime setup
RUN addgroup -S hivepay && \
    adduser -S hivepay -G hivepay

# Copy everything from the builder stage
# This ensures we have the same environment including Prisma client
COPY --from=builder --chown=hivepay:hivepay /app/node_modules ./node_modules
COPY --from=builder --chown=hivepay:hivepay /app/prisma ./prisma
COPY --from=builder --chown=hivepay:hivepay /app/package*.json ./
COPY --from=builder --chown=hivepay:hivepay /app/queueMonitor.js ./

# Create log directory with proper permissions
RUN mkdir -p logs && chown -R hivepay:hivepay logs

# Set ownership
RUN chown -R hivepay:hivepay .

USER hivepay
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "queueMonitor.js"]