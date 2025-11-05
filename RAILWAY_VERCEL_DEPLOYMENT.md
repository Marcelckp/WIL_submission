# Railway + Vercel Deployment Guide

Step-by-step guide to deploy Smart Invoice Capture:
- **Backend** → Railway (with PostgreSQL)
- **Web Portal** → Vercel

---

## Prerequisites

- ✅ GitHub repository with your code
- ✅ Railway account (railway.app)
- ✅ Vercel account (vercel.com)
- ✅ Firebase project with Storage enabled
- ✅ SendGrid account with verified sender email

---

## Part 1: Backend Deployment on Railway

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Sign up/login with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Select your repository

### Step 2: Add PostgreSQL Database

1. In your Railway project, click **"New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will create a PostgreSQL database
4. **Copy the `DATABASE_URL`** - you'll need it later

### Step 3: Configure Railway Service

1. Railway should auto-detect your backend
2. If not, click **"New"** → **"GitHub Repo"** → Select your repo
3. Set **Root Directory** to `backend`

### Step 4: Configure Build Settings

1. Go to your service → **Settings** → **Service**
2. **Root Directory**: `backend`
3. **Build Command**: `npm install && npm run build && npx prisma generate && npx prisma migrate deploy`
4. **Start Command**: `npm start`

### Step 5: Add Environment Variables

1. Go to your service → **Variables** tab
2. Add these variables:

```env
# Database (Railway auto-provides this)
DATABASE_URL=<railway-postgres-url>

# Server
PORT=3000
NODE_ENV=production

# Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<your-random-32-character-secret>

# CORS (will be set after Vercel deployment)
ALLOWED_ORIGINS=https://your-app.vercel.app

# Firebase Storage
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...}
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# Email (SendGrid)
SENDGRID_API_KEY=SG.your_api_key_here
EMAIL_FROM=dev.marcel.developer@gmail.com

# Email Override (REMOVE IN PRODUCTION)
# Leave empty or don't set this variable
```

### Step 6: Deploy

1. Railway will automatically deploy when you push to GitHub
2. Or click **"Deploy"** button
3. Wait for deployment to complete
4. **Copy your Railway URL**: `https://your-app-name.up.railway.app`
5. Your backend API will be at: `https://your-app-name.up.railway.app/api`

### Step 7: Test Backend

```bash
curl https://your-app-name.up.railway.app/api/health
# Should return: {"status":"ok"}
```

### Step 8: Run Database Seed (Optional)

If you want initial data:

1. Go to Railway → Your service → **Deployments** → Click on latest deployment
2. Click **"Shell"** tab
3. Run:
   ```bash
   cd backend
   npm run prisma:seed
   ```

---

## Part 2: Web Portal Deployment on Vercel

### Step 1: Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Sign up/login with GitHub
3. Click **"Add New..."** → **"Project"**
4. **Import** your GitHub repository

### Step 2: Configure Project Settings

1. **Framework Preset**: Next.js (auto-detected)
2. **Root Directory**: `web`
3. **Build Command**: `npm run build` (auto-detected)
4. **Output Directory**: `.next` (auto-detected)
5. **Install Command**: `npm install` (auto-detected)

### Step 3: Add Environment Variables

1. Go to **Environment Variables** section
2. Add:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-app-name.up.railway.app/api
```

**Important**: Replace `your-app-name.up.railway.app` with your actual Railway backend URL!

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build to complete
3. **Copy your Vercel URL**: `https://your-project.vercel.app`

### Step 5: Update Backend CORS

1. Go back to Railway → Your backend service → **Variables**
2. Update `ALLOWED_ORIGINS`:
   ```
   ALLOWED_ORIGINS=https://your-project.vercel.app
   ```
3. Railway will auto-redeploy with new CORS settings

### Step 6: Test Web Portal

1. Open `https://your-project.vercel.app`
2. Try logging in
3. Check browser console for any errors

---

## Part 3: Custom Domain (Optional)

### Vercel Custom Domain

1. Go to Vercel → Your project → **Settings** → **Domains**
2. Add your domain
3. Follow DNS configuration instructions
4. Update `ALLOWED_ORIGINS` in Railway to include your custom domain

### Railway Custom Domain

1. Go to Railway → Your service → **Settings** → **Networking**
2. Add custom domain
3. Configure DNS as instructed

---

## Post-Deployment Checklist

### Backend (Railway)

- [ ] Health check works: `GET /api/health`
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] CORS configured with Vercel URL
- [ ] Firebase Storage accessible
- [ ] SendGrid email sending works

### Web Portal (Vercel)

- [ ] Site loads correctly
- [ ] Login works
- [ ] API calls succeed (check browser console)
- [ ] No CORS errors
- [ ] All pages accessible

### Both

- [ ] Test end-to-end workflow:
  - Create invoice on Android app
  - View invoice on web portal
  - Approve invoice
  - Email sent successfully

---

## Troubleshooting

### Backend Issues

**Database Connection Error**
- Check `DATABASE_URL` format
- Ensure PostgreSQL is linked to your service
- Run migrations: `npx prisma migrate deploy`

**Build Fails**
- Check build logs in Railway
- Ensure `backend` is set as root directory
- Verify `package.json` scripts are correct

**CORS Errors**
- Verify `ALLOWED_ORIGINS` includes your Vercel URL
- Check origin matches exactly (including https://)

### Web Portal Issues

**API Connection Errors**
- Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- Check Railway backend is accessible
- Verify CORS settings on backend

**Build Errors**
- Check build logs in Vercel
- Ensure `web` is set as root directory
- Clear `.next` folder if needed

---

## Environment Variables Summary

### Railway (Backend)
```
DATABASE_URL=<railway-postgres-url>
PORT=3000
NODE_ENV=production
JWT_SECRET=<random-32-chars>
ALLOWED_ORIGINS=https://your-project.vercel.app
FIREBASE_SERVICE_ACCOUNT_KEY=<firebase-json>
FIREBASE_STORAGE_BUCKET=<bucket-name>
SENDGRID_API_KEY=<sendgrid-key>
EMAIL_FROM=dev.marcel.developer@gmail.com
```

### Vercel (Web Portal)
```
NEXT_PUBLIC_API_BASE_URL=https://your-app-name.up.railway.app/api
```

---

## Quick Reference URLs

After deployment, you'll have:

- **Backend API**: `https://your-app-name.up.railway.app/api`
- **Web Portal**: `https://your-project.vercel.app`

Update Android app `build.gradle.kts` with backend URL:
```kotlin
buildConfigField("String", "API_BASE_URL", "\"https://your-app-name.up.railway.app/api/\"")
```

---

## Support

If you encounter issues:

1. Check Railway logs: Railway → Service → Deployments → Logs
2. Check Vercel logs: Vercel → Project → Deployments → Logs
3. Test API directly: `curl https://your-backend.up.railway.app/api/health`
4. Check browser console for frontend errors

