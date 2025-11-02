# Smart Invoice Capture - Setup & Testing Guide

## Quick Start (All Services)

### Option 1: Using npm script (Recommended)
```bash
npm install  # Install root dependencies
npm run setup  # Install all dependencies, setup database, seed data
npm run dev  # Start backend and web app simultaneously
```

### Option 2: Using shell script
```bash
# macOS/Linux
./start-dev.sh

# Windows
start-dev.bat
```

### Option 3: Manual start
```bash
# Terminal 1 - Backend
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev

# Terminal 2 - Web App
cd web
npm install
npm run dev
```

## Service URLs

Once started, access:
- **Backend API**: http://localhost:3000/api
- **API Health Check**: http://localhost:3000/api/health
- **Web Admin Portal**: http://localhost:3001 (configured to avoid port conflict)
- **Prisma Studio** (database viewer): `npm run prisma:studio` in backend directory

## Testing Checklist

### 1. Backend API Testing

#### Health Check
```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok"}
```

#### Login (Get JWT Token)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'
# Expected: JSON with token, user info
```

#### Test with Token
```bash
# Replace YOUR_TOKEN with actual token from login
TOKEN="YOUR_TOKEN"

# Get invoices
curl http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN"

# Get active BOQ items
curl http://localhost:3000/api/boq/active/items?q=cement \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Web Admin Portal Testing

1. **Open**: http://localhost:3001
2. **Login**:
   - Email: `admin@test.com`
   - Password: `admin123`
3. **Test Features**:
   - ✅ Navigate to BOQ page
   - ✅ Upload BOQ Excel file
   - ✅ View invoice list
   - ✅ Approve/Reject invoices

### 3. Android App Testing

1. **Configure API URL** in `android/app/build.gradle.kts`:
   - For Emulator: `http://10.0.2.2:3000/api` (default)
   - For Physical Device: `http://YOUR_COMPUTER_IP:3000/api`
2. **Run in Android Studio**:
   - Open project in Android Studio
   - Run app on emulator or device
3. **Test Flow**:
   - ✅ Login screen
   - ✅ Dashboard with statistics
   - ✅ Create new invoice
   - ✅ Add items from BOQ
   - ✅ Upload photos
   - ✅ Save invoice

### 4. Database Testing

View database:
```bash
cd backend
npm run prisma:studio
# Opens at http://localhost:5555
```

## Default Test Credentials

From `backend/prisma/seed.ts`:

**Admin User:**
- Email: `admin@test.com`
- Password: `admin123`
- Role: `ADMIN`

**Field Operator:**
- Email: `field@test.com`
- Password: `field123`
- Role: `FIELD`

**Company:**
- Name: `Test Company`
- VAT Number: `VAT123456`

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000 (backend)
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001 (web)
lsof -ti:3001 | xargs kill -9
```

### Database Issues
```bash
cd backend
# Reset database
rm prisma/dev.db
npm run prisma:migrate
npm run prisma:seed
```

### Module Not Found
```bash
# Install all dependencies
npm run install:all
```

### CORS Errors
- Backend CORS is configured to allow all origins in development
- For production, update CORS settings in `backend/src/server.ts`

## Environment Variables

### Backend
Create `backend/.env`:
```env
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
DATABASE_URL="file:./prisma/dev.db"
AZURE_STORAGE_CONNECTION_STRING="your-azure-connection-string"
AZURE_BLOB_BASE_URL="your-azure-blob-url"
```

### Web
Create `web/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

## Project Structure

```
WIL/
├── backend/          # Node.js/Express API
│   ├── src/
│   ├── prisma/
│   └── package.json
├── web/              # Next.js Admin Portal
│   ├── src/
│   └── package.json
├── android/          # Android App
│   └── app/
├── package.json      # Root package.json with scripts
├── start-dev.sh      # Startup script (macOS/Linux)
├── start-dev.bat     # Startup script (Windows)
└── README_SETUP.md   # This file
```

## Next Steps After Setup

1. ✅ Test backend API endpoints
2. ✅ Test web admin portal login and BOQ upload
3. ✅ Test Android app login and invoice creation
4. ✅ Verify database contains seeded data
5. ✅ Test invoice workflow (create → submit → approve)

## Support

If you encounter issues:
1. Check that all services are running
2. Verify ports 3000 and 3001 are available
3. Check database is seeded (`npm run prisma:seed`)
4. Verify all dependencies are installed (`npm run install:all`)

