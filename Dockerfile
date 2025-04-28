# Stage 1: Builder with full build tools
FROM node:18-alpine AS builder
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

# Install dependencies including ts-node for runtime TS execution
RUN npm ci && \
    npm install --save ts-node module-alias && \
    npm cache clean --force

# Copy project files
COPY tsconfig.json ./
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Production image
FROM node:18-alpine
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    openssl \
    ca-certificates

# Copy files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/queueRunner.ts ./
COPY --from=builder /app/src ./src

# Create a bootstrap file to handle module aliases
RUN echo 'require("module-alias/register");\
require("module-alias").addAliases({\
  "@": "/app",\
  "@/src": "/app/src"\
});\
require("ts-node/register");\
require("./queueRunner");' > bootstrap.js

# Environment variables
ENV NODE_ENV=production
ENV TS_NODE_TRANSPILE_ONLY=true

# Run with the bootstrap file
CMD ["node", "bootstrap.js"]











# # Stage 1: Builder with full build tools
# ARG TARGETARCH=arm64
# FROM --platform=linux/${TARGETARCH} node:18-alpine AS builder
# WORKDIR /app

# # Install system dependencies
# RUN apk add --no-cache \
#     python3 \
#     make \
#     g++ \
#     openssl \
#     git

# # Copy package files and lockfile
# COPY package*.json ./
# COPY prisma/ ./prisma/

# # Install production and dev dependencies
# RUN npm ci --include=dev && \
#     npm cache clean --force

# # Install build tools
# RUN npm install \
#     typescript@5.3.3 \
#     tsc-alias@1.8.8 \
#     @types/bull@4.10.2

# # Copy all source files
# COPY . .

# # Build and resolve path aliases
# RUN npx tsc -p tsconfig.json && \
#     npx tsc-alias && \
#     npx prisma generate

# # Stage 2: Production image
# ARG TARGETARCH=arm64
# FROM --platform=linux/${TARGETARCH} node:18-alpine
# WORKDIR /app

# # Install runtime dependencies
# RUN apk add --no-cache \
#     openssl \
#     ca-certificates

# # Copy built files
# COPY --from=builder /app/node_modules ./node_modules
# COPY --from=builder /app/dist ./dist
# COPY --from=builder /app/prisma ./prisma

# # Security
# USER node
# ENV NODE_ENV=production
# HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
#     CMD node -e "require('@/lib/queue/config').redisClient.ping().catch(() => process.exit(1))"

# CMD ["node", "dist/queueRunner.js"]