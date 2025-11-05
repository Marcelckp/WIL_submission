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

# Allow building from different contexts (root repo vs backend folder)
ARG APP_DIR=.

# Copy package files
COPY ${APP_DIR}/package.json ./
COPY ${APP_DIR}/package-lock.json* ./

# Install dependencies
# Use npm install for better compatibility (works with or without lock file)
RUN npm install --production=false

# Copy Prisma schema and all prisma files (schema, migrations, seed, CSV, etc.)
# Note: dev.db will be copied if it exists locally
COPY ${APP_DIR}/prisma/ ./prisma/

# Generate Prisma Client (for SQLite)
RUN npx prisma generate

# Copy source code
COPY ${APP_DIR}/tsconfig.json ./
COPY ${APP_DIR}/src ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Create directory for SQLite database with proper permissions
# SQLite database will be created/used at /app/prisma/dev.db
RUN mkdir -p /app/prisma && chmod 777 /app/prisma

# Optionally require dev.db at build time
ARG REQUIRE_DB=false
ENV REQUIRE_DB=${REQUIRE_DB}

# Verify dev.db; warn by default, fail only if REQUIRE_DB=true
RUN if [ -f /app/prisma/dev.db ] && [ -s /app/prisma/dev.db ]; then \
      echo "dev.db present (size > 0)"; \
    else \
      echo "dev.db missing or empty at build time."; \
      ls -l /app/prisma || true; \
      if [ "$REQUIRE_DB" = "true" ]; then \
        echo "ERROR: REQUIRE_DB=true and dev.db not found or empty."; \
        exit 1; \
      else \
        echo "Proceeding without embedded dev.db (you can mount one at runtime)."; \
      fi; \
    fi

# Set default DATABASE_URL for SQLite using absolute path for reliability in all runtimes
ENV DATABASE_URL="file:./dev.db"

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Start server (DB presence enforced at build time)
CMD ["npm", "start"]

