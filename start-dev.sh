#!/bin/bash

# Smart Invoice Capture - Development Startup Script
# This script starts all services for local development

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Smart Invoice Capture - Starting Services${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Error: Node.js is not installed${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js version 18+ is recommended${NC}"
fi

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

# Check if ports are available
if check_port 3000; then
    echo -e "${YELLOW}Warning: Port 3000 is already in use${NC}"
    echo -e "${YELLOW}Backend may not start properly${NC}"
fi

if check_port 3001; then
    echo -e "${YELLOW}Warning: Port 3001 is already in use${NC}"
    echo -e "${YELLOW}Web app may not start properly${NC}"
fi

echo ""
echo -e "${GREEN}Installing dependencies if needed...${NC}"
cd "$(dirname "$0")"

# Install root dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing root dependencies...${NC}"
    npm install --silent
fi

# Install backend dependencies
if [ ! -d "backend/node_modules" ]; then
    echo -e "${BLUE}Installing backend dependencies...${NC}"
    cd backend && npm install --silent && cd ..
fi

# Install web dependencies
if [ ! -d "web/node_modules" ]; then
    echo -e "${BLUE}Installing web dependencies...${NC}"
    cd web && npm install --silent && cd ..
fi

# Setup database if needed
if [ ! -f "backend/prisma/dev.db" ]; then
    echo -e "${BLUE}Setting up database...${NC}"
    cd backend
    npm run prisma:generate --silent
    npm run prisma:migrate --silent
    npm run prisma:seed --silent
    cd ..
fi

echo ""
echo -e "${GREEN}Starting services...${NC}"
echo -e "${BLUE}Backend API: http://localhost:3000${NC}"
echo -e "${BLUE}Web Admin Portal: http://localhost:3000 (Next.js default)${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Start services using concurrently if available, otherwise start manually
if command -v npx &> /dev/null && npx -y concurrently --version &> /dev/null 2>&1; then
    npx -y concurrently \
        --names "BACKEND,WEB" \
        --prefix-colors "blue,green" \
        "cd backend && npm run dev" \
        "cd web && PORT=3001 npm run dev"
else
    # Fallback: start in background
    echo -e "${BLUE}Starting backend...${NC}"
    cd backend && npm run dev &
    BACKEND_PID=$!
    
    sleep 3
    
    echo -e "${GREEN}Starting web app...${NC}"
    cd ../web && npm run dev &
    WEB_PID=$!
    
    echo ""
    echo -e "${GREEN}Services started!${NC}"
    echo -e "Backend PID: $BACKEND_PID"
    echo -e "Web PID: $WEB_PID"
    echo ""
    echo "Press Ctrl+C to stop all services"
    
    # Wait for interrupt
    trap "kill $BACKEND_PID $WEB_PID 2>/dev/null; exit" INT TERM
    wait
fi

