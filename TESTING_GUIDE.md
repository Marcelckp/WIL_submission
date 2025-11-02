# Testing Guide - Smart Invoice Capture

This guide helps you test all components of the application.

## Prerequisites

1. **Node.js 18+** installed
2. **npm** installed
3. **All dependencies installed** (`npm run setup`)

## Quick Start

```bash
# From project root
npm run dev
```

This starts:
- Backend API on port 3000
- Web Admin Portal on port 3001

## Step-by-Step Testing

### 1. Verify Services are Running

#### Backend Health Check
```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok"}
```

#### Web Portal
- Open browser: http://localhost:3001
- Should see login page

### 2. Test Authentication

#### Login via API
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'
```

Expected response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "email": "admin@test.com",
    "role": "ADMIN",
    "companyId": "..."
  }
}
```

#### Login via Web Portal
1. Go to http://localhost:3001
2. Enter:
   - Email: `admin@test.com`
   - Password: `admin123`
3. Should redirect to dashboard

### 3. Test BOQ Management

#### Upload BOQ via API
```bash
TOKEN="YOUR_TOKEN_FROM_LOGIN"

curl -X POST http://localhost:3000/api/boq/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@path/to/your/boq.xlsx"
```

#### Upload BOQ via Web Portal
1. Navigate to BOQ page
2. Click "Upload BOQ"
3. Select Excel file
4. Should show success message

#### Get BOQ Items
```bash
curl http://localhost:3000/api/boq/active/items?q=cement \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Test Invoice Creation

#### Create Invoice via API
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-15",
    "customerName": "Test Customer",
    "projectSite": "Test Site",
    "preparedBy": "John Doe",
    "lines": [
      {
        "itemName": "10 - Soil dig, backfill, complete",
        "description": "Soil dig",
        "unit": "M3",
        "unitPrice": "126.63",
        "quantity": "10",
        "amount": "1266.30"
      }
    ]
  }'
```

#### Create Invoice via Android App
1. Open Android app
2. Login with field operator credentials:
   - Email: `field@test.com`
   - Password: `field123`
3. Navigate to "Create Invoice"
4. Fill in details
5. Search and add items from BOQ
6. Add photos (optional)
7. Save invoice

### 5. Test Invoice Workflow

#### Submit Invoice
```bash
curl -X POST http://localhost:3000/api/invoices/INVOICE_ID/submit \
  -H "Authorization: Bearer $TOKEN"
```

#### Approve Invoice (Admin only)
```bash
curl -X POST http://localhost:3000/api/invoices/INVOICE_ID/approve \
  -H "Authorization: Bearer $TOKEN"
```

#### Reject Invoice (Admin only)
```bash
curl -X POST http://localhost:3000/api/invoices/INVOICE_ID/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Incorrect pricing"}'
```

### 6. Test Invoice Listing

#### Get All Invoices
```bash
curl http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Invoice by ID
```bash
curl http://localhost:3000/api/invoices/INVOICE_ID \
  -H "Authorization: Bearer $TOKEN"
```

### 7. Test Media Upload

#### Upload Photo
```bash
curl -X POST http://localhost:3000/api/invoices/INVOICE_ID/media \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@path/to/photo.jpg"
```

### 8. Test PDF Generation

#### Download Invoice PDF
```bash
curl http://localhost:3000/api/invoices/INVOICE_ID/pdf \
  -H "Authorization: Bearer $TOKEN" \
  -o invoice.pdf
```

**Note**: PDF is only available for approved invoices (`status: "FINAL"`)

### 9. Test Polling

#### Get Invoice Updates
```bash
curl http://localhost:3000/api/invoices/INVOICE_ID/updates?since=0 \
  -H "Authorization: Bearer $TOKEN"
```

Response includes:
- `changed`: boolean
- `lastUpdatedAt`: timestamp
- `status`: current status
- `comments`: new comments
- `serverPdfUrl`: PDF URL if approved

### 10. Test Comments

#### Add Comment
```bash
curl -X POST http://localhost:3000/api/invoices/INVOICE_ID/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Please review this invoice"}'
```

#### Get Comments
Comments are included in invoice detail endpoint:
```bash
curl http://localhost:3000/api/invoices/INVOICE_ID \
  -H "Authorization: Bearer $TOKEN"
```

## Complete Test Flow

### End-to-End Test

1. **Admin uploads BOQ**
   - Web portal → BOQ page → Upload Excel file

2. **Field operator creates invoice**
   - Android app → Create Invoice
   - Add customer details
   - Search and add items from BOQ
   - Upload photos
   - Save invoice

3. **Field operator submits invoice**
   - Android app → Invoice Detail → Submit

4. **Admin reviews invoice**
   - Web portal → Invoices → View invoice
   - Review details, photos, comments

5. **Admin approves/rejects**
   - Web portal → Approve (generates PDF)
   - OR Reject with reason

6. **Field operator checks status**
   - Android app → Invoice Detail
   - View status, comments, approved PDF

## Test Credentials

### Admin
- Email: `admin@test.com`
- Password: `admin123`
- Role: `ADMIN`
- Access: Full system access

### Field Operator
- Email: `field@test.com`
- Password: `field123`
- Role: `FIELD`
- Access: Invoice creation, viewing own invoices

## Common Issues

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### Database Not Seeded
```bash
cd backend
npm run prisma:seed
```

### CORS Errors
- Backend has CORS enabled for development
- Verify backend is running on port 3000
- Check web app API URL in `.env.local`

### Authentication Errors
- Verify token is included in Authorization header
- Check token hasn't expired
- Re-login if token is invalid

## Next Steps

After testing:
1. ✅ Verify all endpoints work
2. ✅ Test error handling
3. ✅ Verify data persistence
4. ✅ Test on different devices (Android)
5. ✅ Test with different user roles

