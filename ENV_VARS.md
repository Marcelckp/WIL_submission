# Environment Variables

Use these templates to create `.env` files locally.

## Backend (`backend/.env`)

```
PORT=3000
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me"

# Firebase Cloud Storage Configuration
# Get these from Firebase Console: https://console.firebase.google.com/
# 1. Go to Project Settings > Service Accounts
# 2. Click "Generate New Private Key" to download JSON
# 3. Copy the entire JSON content and paste it here (as a single-line JSON string)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
# Your Firebase Storage bucket name (e.g., "your-project.appspot.com")
FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"

# Email Configuration (SendGrid API)
SENDGRID_API_KEY="SG.your_api_key_here"
EMAIL_FROM="dev.marcel.developer@gmail.com"  # Must be verified in SendGrid first

# Email Override (for testing only)
# When set, ALL emails will be sent to this address instead of the intended recipient
# Remove or leave empty to disable override and send to actual recipients
EMAIL_OVERRIDE_TO="marcelpal9999@gmail.com"
```

## Web (`web/.env.local`)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
PORT=3001
```

> Note: Some environments block committing `.env` files. Use this document to copy the correct values.
