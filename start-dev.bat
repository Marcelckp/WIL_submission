@echo off
REM Smart Invoice Capture - Development Startup Script (Windows)
REM This script starts all services for local development

echo ========================================
echo Smart Invoice Capture - Starting Services
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed
    exit /b 1
)

echo Installing dependencies if needed...
cd /d "%~dp0"

REM Install root dependencies
if not exist "node_modules" (
    echo Installing root dependencies...
    call npm install
)

REM Install backend dependencies
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

REM Install web dependencies
if not exist "web\node_modules" (
    echo Installing web dependencies...
    cd web
    call npm install
    cd ..
)

REM Setup database if needed
if not exist "backend\prisma\dev.db" (
    echo Setting up database...
    cd backend
    call npm run prisma:generate
    call npm run prisma:migrate
    call npm run prisma:seed
    cd ..
)

echo.
echo Starting services...
echo Backend API: http://localhost:3000
echo Web Admin Portal: http://localhost:3001
echo.
echo Press Ctrl+C to stop all services
echo.

REM Start services using concurrently
call npx concurrently --names "BACKEND,WEB" --prefix-colors "blue,green" "cd backend && npm run dev" "cd web && set PORT=3001 && npm run dev"

pause

