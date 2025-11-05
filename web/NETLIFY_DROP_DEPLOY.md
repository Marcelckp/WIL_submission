# Netlify Deployment Guide

## Important: Netlify Drop vs Netlify with Git Integration

**Netlify Drop** (drag-and-drop) only works with **static sites**. Next.js App Router with dynamic routes requires server-side rendering, which Netlify Drop cannot handle.

## Recommended Solution: Use Netlify with Git Integration

Instead of Netlify Drop, connect your GitHub repository to Netlify for automatic deployments:

## Steps to Deploy

### Step 1: Build the Site Locally

```bash
cd web
npm install
npm run build
```

This creates an `out/` directory with the static files.

### Step 2: Deploy to Netlify Drop

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop the **`out/`** folder (not the entire web folder)
3. Wait for deployment

### Step 3: Set Environment Variable

1. Go to your site → **Site settings** → **Environment variables**
2. Add:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://wilsubmission-production.up.railway.app/api
   ```
3. **Redeploy** after adding the variable

## Important Notes

⚠️ **Static Export Limitations**:

- No server-side rendering (SSR)
- No API routes
- No dynamic routes with `getServerSideProps`
- All pages are pre-rendered at build time

✅ **What Works**:

- Client-side routing
- API calls to external backend (Railway)
- Static pages
- Client-side state management

## Alternative: Use Netlify CLI (Recommended)

For better Next.js support, use Netlify CLI instead of Drop:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
cd web
netlify deploy --prod

# Or link to existing site
netlify link
netlify deploy --prod
```

Then install the Next.js plugin in Netlify Dashboard → Plugins → Add → "@netlify/plugin-nextjs"

## Quick Fix for Current Deployment

1. **Rebuild locally**:

   ```bash
   cd web
   npm run build
   ```

2. **Upload `out/` folder** to Netlify Drop

3. **Set environment variable** in Netlify Dashboard

4. **Redeploy**

The site should now work correctly!
