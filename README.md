# Smart Invoice Capture

A comprehensive invoice management system designed for field operators and office administrators. The application enables rapid invoice creation from Bills of Quantities (BOQ), automatic validation, approval workflows, and professional PDF generation.

## [Youtube demo and walkthrough video link](https://www.youtube.com/watch?v=BBmEYcDRULo)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

Smart Invoice Capture is a full-stack application consisting of three main components:

1. **Backend API** - Express.js/TypeScript server with Prisma ORM
2. **Web Admin Portal** - Next.js React application for office administrators
3. **Android Mobile App** - Native Android app for field operators

The system streamlines invoice creation by allowing field operators to search BOQ items, automatically populate rates and units, capture photos, and submit invoices for approval. Administrators can upload BOQ files, validate invoices, and generate professional PDF tax invoices.

## Features

### Field Operator (Mobile App)

- ✅ Search BOQ items with autocomplete
- ✅ Create invoices offline with local caching
- ✅ Capture and attach photos
- ✅ Submit invoices for approval
- ✅ View invoice status and comments
- ✅ Generate and share PDF invoices

### Admin Portal (Web)

- ✅ Upload and validate BOQ Excel files
- ✅ Manage BOQ versions and activate versions
- ✅ Review and approve/reject invoices
- ✅ Add comments and feedback
- ✅ View invoice metrics and reports
- ✅ Manage company settings and users

### Backend

- ✅ RESTful API with JWT authentication
- ✅ Excel BOQ validation and parsing
- ✅ PDF invoice generation
- ✅ File storage (Firebase Storage/Azure Blob)
- ✅ Email notifications
- ✅ Role-based access control (ADMIN, FIELD)

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌────────────────────┐
│   Android App   │         │   Web Portal    │         │   Backend API      │
│   (Kotlin)      │────────▶│   (Next.js)     │────────▶│   (Express)        │
│                 │         │                 │         │                    │
│  - Room DB      │         │  - React        │         │  - Prisma ORM      │
│  - Offline Sync │         │  - TailwindCSS  │         │  - SQLite/Postgres │
└─────────────────┘         └─────────────────┘         └────────────────────┘
                                                               │
                                                               ▼
                                                        ┌─────────────────┐
                                                        │  File Storage   │
                                                        │  Firebase/Azure │
                                                        └─────────────────┘
```

### Tech Stack

**Backend:**

- Node.js 20+ with Express.js
- TypeScript
- Prisma ORM
- SQLite (dev) / PostgreSQL (production)
- JWT authentication
- PDFKit for PDF generation

**Web:**

- Next.js 14
- React 18
- TypeScript
- TailwindCSS
- Zustand for state management
- React Query for data fetching

**Android:**

- Kotlin
- Android SDK 24+
- Room Database
- Retrofit for API calls
- Glide for image loading

## Prerequisites

Before you begin, ensure you have the following installed:

### Required

- **Node.js** 18.0.0 or higher ([Download](https://nodejs.org/))
- **npm** 9.0.0 or higher (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))

### For Android Development

- **Java Development Kit (JDK)** 17 ([Download](https://adoptium.net/))
- **Android Studio** Arctic Fox or newer ([Download](https://developer.android.com/studio))
- **Android SDK** (installed via Android Studio)

### Optional but Recommended

- **PostgreSQL** (if using production database)
- **Docker** (for containerized deployment)

## Quick Start

The fastest way to get started:

```bash
# Clone the repository
git clone <repository-url>
cd WIL

# Install all dependencies
npm run install:all

# Setup database and seed data
npm run setup

# Start all services (backend + web)
npm run dev
```

**Backend API:** http://localhost:3000  
**Web Portal:** http://localhost:3001

For detailed setup instructions, see [Installation](#installation).

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd WIL
```

### 2. Install Dependencies

#### Option A: Install All Components (Recommended)

```bash
npm run install:all
```

This installs dependencies for root, backend, and web components.

#### Option B: Install Individually

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend
npm install
cd ..

# Web dependencies
cd web
npm install
cd ..
```

### 3. Setup Database

```bash
cd backend

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database with sample data
npm run prisma:seed
```

This creates a SQLite database at `backend/prisma/dev.db` with sample users and BOQ data.

### 4. Configure Environment Variables

See [Environment Variables](#environment-variables) section for required configuration.

## Running the Application

### Running All Services Together

#### Using npm script (Recommended)

```bash
npm run dev
```

This starts both backend (port 3000) and web portal (port 3001) concurrently.

#### Using startup script

**Linux/macOS:**

```bash
./start-dev.sh
```

**Windows:**

```bash
start-dev.bat
```

### Running Individual Components

#### Backend API Only

```bash
cd backend
npm run dev
```

Backend runs on http://localhost:3000

**Available endpoints:**

- API: http://localhost:3000/api
- Health check: http://localhost:3000/api/health

#### Web Portal Only

```bash
cd web
npm run dev
```

Web portal runs on http://localhost:3001

#### Android App

1. Open Android Studio
2. Open the `android` folder
3. Sync Gradle files
4. Run on an emulator or connected device

**Configuration:**

- Update `android/gradle.properties` to set `API_BASE_URL` for your backend
- For emulator: `http://10.0.2.2:3000/api/`
- For physical device: `http://YOUR_COMPUTER_IP:3000/api/`

### Building for Production

#### Backend

```bash
cd backend
npm run build
npm start
```

#### Web

```bash
cd web
npm run build
npm start
```

#### Android

```bash
cd android
./gradlew assembleRelease
```

APK will be in `android/app/build/outputs/apk/release/`

## Environment Variables

### Backend Environment Variables

Create `backend/.env` file:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# JWT Secret (generate a strong random string)
JWT_SECRET="your-super-secret-jwt-key-change-this"

# CORS Origins (comma-separated)
ALLOWED_ORIGINS="http://localhost:3001,https://your-domain.com"

# Server Port (optional, defaults to 3000)
PORT=3000

# Firebase Storage (optional, for file storage)
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL="your-client-email"

# Azure Blob Storage (optional, alternative to Firebase)
AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
AZURE_STORAGE_CONTAINER_NAME="invoices"

# Email Service (optional)
SENDGRID_API_KEY="your-sendgrid-api-key"
RESEND_API_KEY="your-resend-api-key"
```

### Web Environment Variables

Create `web/.env.local` file:

```env
# Backend API URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api

# For production, use your deployed backend URL:
# NEXT_PUBLIC_API_BASE_URL=https://your-backend.railway.app/api
```

### Android Environment Variables

Edit `android/gradle.properties`:

```properties
# API Base URL
# For Android Emulator:
API_BASE_URL=http://10.0.2.2:3000/api/

# For Physical Device (replace with your computer's IP):
# API_BASE_URL=http://192.168.1.XXX:3000/api/

# For Production:
# API_BASE_URL=https://your-backend.railway.app/api/
```

## Project Structure

```
WIL/
├── backend/                 # Express.js backend API
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth middleware
│   │   └── server.ts       # Entry point
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   ├── migrations/     # Database migrations
│   │   ├── seed.ts         # Seed data
│   │   └── dev.db          # SQLite database
│   ├── dist/               # Compiled JavaScript
│   └── Dockerfile          # Docker configuration
│
├── web/                     # Next.js web portal
│   ├── src/
│   │   ├── app/            # Next.js app router pages
│   │   ├── lib/            # Utilities and API client
│   │   └── store/          # Zustand state management
│   └── public/             # Static assets
│
├── android/                 # Android mobile app
│   ├── app/
│   │   └── src/main/java/  # Kotlin source code
│   └── gradle.properties    # Build configuration
│
├── .github/workflows/       # CI/CD pipelines
├── DevOps.md                # DevOps documentation
├── Context.md               # Project context and specifications
└── package.json             # Root package.json with scripts
```

## API Documentation

### Authentication

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@test.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "admin@test.com",
    "role": "ADMIN"
  }
}
```

### BOQ Management

#### Upload BOQ

```http
POST /api/boq/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <excel-file>
```

#### Get Active BOQ Items

```http
GET /api/boq/active/items?q=search&limit=20
Authorization: Bearer <token>
```

### Invoice Management

#### Create Invoice

```http
POST /api/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerName": "Customer Name",
  "projectSite": "Project Site",
  "preparedBy": "John Doe",
  "lines": [
    {
      "itemName": "Item Name",
      "unit": "M",
      "unitPrice": "100.00",
      "quantity": "10",
      "amount": "1000.00"
    }
  ]
}
```

#### Get Invoice

```http
GET /api/invoices/:id
Authorization: Bearer <token>
```

#### Submit Invoice

```http
POST /api/invoices/:id/submit
Authorization: Bearer <token>
```

#### Approve Invoice

```http
POST /api/invoices/:id/approve
Authorization: Bearer <token>
```

#### Upload Media

```http
POST /api/invoices/:id/media
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image-file>
```

### Health Check

```http
GET /api/health
```

**Response:**

```json
{
  "status": "ok"
}
```

## Testing

### Backend Tests

```bash
cd backend
npm test
```

### Web Tests

```bash
cd web
npm test
```

### Android Tests

```bash
cd android
./gradlew test
```

## Deployment

### Backend Deployment (Railway)

1. Connect Railway to your GitHub repository
2. Set environment variables in Railway dashboard
3. Railway automatically deploys on push to `main` branch
4. See `DevOps.md` for detailed deployment documentation

**Required Environment Variables:**

- `DATABASE_URL`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`

### Web Deployment (Netlify)

1. Connect Netlify to your GitHub repository
2. Configure build settings:
   - Build command: `cd web && npm run build`
   - Publish directory: `web/.next`
3. Set environment variables:
   - `NEXT_PUBLIC_API_BASE_URL`
4. Deploy automatically on push to `main`

### Android Deployment (Play Store)

1. Create a GitHub Release with version tag (e.g., `v1.0.0`)
2. GitHub Actions automatically builds and publishes to Play Store
3. See `.github/workflows/play-store-release.yml` for details

For detailed deployment information, see [DevOps.md](./DevOps.md).

## Troubleshooting

### Backend Issues

**Database not found:**

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

**Port 3000 already in use:**

- Change `PORT` in `.env` or kill the process using port 3000

**Prisma Client not generated:**

```bash
cd backend
npm run prisma:generate
```

### Web Issues

**API connection errors:**

- Verify `NEXT_PUBLIC_API_BASE_URL` in `web/.env.local`
- Ensure backend is running on the correct port
- Check CORS configuration in backend

**Build errors:**

```bash
cd web
rm -rf .next node_modules
npm install
npm run build
```

### Android Issues

**API connection errors:**

- Verify `API_BASE_URL` in `android/gradle.properties`
- For emulator: use `http://10.0.2.2:3000/api/`
- For physical device: use your computer's IP address

**Build errors:**

```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Database Issues

**Reset database:**

```bash
cd backend
rm prisma/dev.db
npm run prisma:migrate
npm run prisma:seed
```

**View database:**

```bash
cd backend
npm run prisma:studio
```

This opens Prisma Studio at http://localhost:5555

## Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Make your changes
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Create a Pull Request

### Code Style

- **Backend**: TypeScript with ESLint
- **Web**: TypeScript with Next.js ESLint config
- **Android**: Kotlin with standard Android conventions

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Include integration tests for API endpoints

## Additional Resources

- [Project Context](./Context.md) - Detailed project specifications and requirements
- [DevOps Documentation](./DevOps.md) - CI/CD pipeline and deployment guides
- [Backend README](./backend/README.md) - Backend-specific documentation
- [Web README](./web/README.md) - Web portal documentation

## License

MIT

## Contributors & Work Distribution

This project was developed collaboratively by the following team members:

Name  : Omphile Hlongwane (ST10026037)-	Led documentation writing, contributed to presentation content and delivery, managed Scrum board setup & task tracking, assisted with requirements analysis and testing

Name: Gculisa Kolobe	(ST10058639)-	Co-led documentation and presentation development, maintained and organized Scrum board, provided UI/UX input, supported project coordination, testing, and quality assurance

Name: Marcel Palmer	(ST10265652)-	Led application development (front-end & back-end), configured database and implemented core logic, handled integration and debugging, ensured application functionality

All members actively participated in planning, agile ceremonies, and project reviews to ensure successful completion.

## Support

For issues and questions:

- Create an issue in the repository
- Contact the development team

---

**Last Updated:** 5 November 2025
