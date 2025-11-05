# Production Environment Variables

Copy these to your deployment platform's environment variables section.

## Backend (Railway/Render/DigitalOcean)

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database (PostgreSQL - provided by platform)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Security (generate a strong random secret)
JWT_SECRET=<generate-random-32-character-secret>

# CORS (comma-separated list of allowed origins)
# Example: ALLOWED_ORIGINS=https://your-app.vercel.app,https://another-domain.com
# Leave empty to allow all origins (not recommended for production)
ALLOWED_ORIGINS=https://your-web-app.vercel.app

# Firebase Cloud Storage
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...}
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# Email (SendGrid)
SENDGRID_API_KEY=SG.your_api_key_here
EMAIL_FROM=dev.marcel.developer@gmail.com

# Email Override (REMOVE THIS IN PRODUCTION - leave empty or don't set)
# EMAIL_OVERRIDE_TO=
```

## Web Portal (Vercel/Netlify)

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.up.railway.app/api
```

## Important Notes

1. **JWT_SECRET**: Generate a strong random secret (minimum 32 characters)
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **ALLOWED_ORIGINS**: Set this to your web portal URL(s) for security
   - Example: `ALLOWED_ORIGINS=https://your-app.vercel.app`
   - Multiple origins: `ALLOWED_ORIGINS=https://app1.vercel.app,https://app2.vercel.app`
   - Android apps don't need to be in this list (they use direct API calls)

3. **EMAIL_OVERRIDE_TO**: Remove or leave empty in production
   - This should only be used for testing
   - In production, emails go to actual customer emails

4. **DATABASE_URL**: Provided automatically by Railway/Render/DigitalOcean
   - Just copy the provided PostgreSQL connection string

5. **FIREBASE_SERVICE_ACCOUNT_KEY**: Must be valid JSON
   - Get from Firebase Console → Project Settings → Service Accounts
   - Copy entire JSON as a single-line string
   - Ensure service account has "Storage Admin" role

