# Stage 1: Builder with full build tools
ARG TARGETARCH=arm64
FROM --platform=linux/${TARGETARCH} node:18-alpine AS builder
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    git

# Copy package files and lockfile
COPY package*.json ./
COPY prisma/ ./prisma/

# Install production and dev dependencies
RUN npm ci --include=dev && \
    npm cache clean --force

# Install build tools
RUN npm install \
    typescript@5.3.3 \
    tsc-alias@1.8.8 \
    @types/bull@4.10.2

# Copy all source files
COPY . .

# Build and resolve path aliases
RUN npx tsc -p tsconfig.json && \
    npx tsc-alias && \
    npx prisma generate

# Stage 2: Production image
ARG TARGETARCH=arm64
FROM --platform=linux/${TARGETARCH} node:18-alpine
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    openssl \
    ca-certificates

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Security
USER node
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "require('@/lib/queue/config').redisClient.ping().catch(() => process.exit(1))"

CMD ["node", "dist/queueRunner.js"]