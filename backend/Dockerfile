# Dockerfile for Railway deployment with SQLite
FROM node:20-slim

# Install build dependencies and OpenSSL for Prisma native engine
# Using Debian-based image for better Prisma compatibility
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY package-lock.json* ./

# Install dependencies
# Use npm install for better compatibility (works with or without lock file)
RUN npm install --production=false

# Copy Prisma schema, migrations, and dev.db (if exists)
COPY prisma ./prisma/

# Generate Prisma Client (for SQLite)
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Create directory for SQLite database with proper permissions
# SQLite database will be created/used at /app/prisma/dev.db
RUN mkdir -p /app/prisma && chmod 777 /app/prisma

# Set default DATABASE_URL for SQLite if not provided
ENV DATABASE_URL="file:./prisma/dev.db"

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Run migrations and seed database, then start server
# For SQLite, `prisma migrate deploy` applies pending migrations
# `prisma db seed` runs the seed script to populate initial data
CMD sh -c "npx prisma migrate deploy || echo 'Migrations already applied' && (npx prisma db seed || echo 'Seed already applied or failed') && npm start"

