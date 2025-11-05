# Netlify Deployment Guide

## Important: Netlify Drop vs Netlify with Git Integration

**Netlify Drop** (drag-and-drop) only works with **static sites**. Next.js App Router with dynamic routes requires server-side rendering, which Netlify Drop **cannot handle**.

## Recommended Solution: Use Netlify with Git Integration

Instead of Netlify Drop, connect your GitHub repository to Netlify for automatic deployments:

### Step 1: Connect Repository to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect your GitHub repository
4. Select your repository

### Step 2: Configure Build Settings

- **Base directory**: `web` (if monorepo)
- **Build command**: `npm run build`
- **Publish directory**: `.next` (or leave empty, plugin handles it)

### Step 3: Install Next.js Plugin

1. Go to **Site settings** → **Plugins**
2. Click **"Add plugin"**
3. Search for **"@netlify/plugin-nextjs"**
4. Click **"Install"**

This plugin is **REQUIRED** for Next.js App Router to work correctly on Netlify.

### Step 4: Set Environment Variables

1. Go to **Site settings** → **Environment variables**
2. Add:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://wilsubmission-production.up.railway.app/api
   ```
3. Select **Production**, **Preview**, and **Development** environments
4. Click **Save**

### Step 5: Deploy

1. Click **"Deploy site"** or push to your repository
2. Netlify will automatically build and deploy

## Alternative: Use Netlify CLI

If you prefer CLI deployment:

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

**Important**: Still install the Next.js plugin in Netlify Dashboard after CLI deployment.

## Why Not Netlify Drop?

Netlify Drop only supports static HTML/CSS/JS files. It cannot:
- Run Node.js server-side code
- Handle dynamic routes (`[id]`)
- Support Next.js App Router features
- Run server-side rendering (SSR)

## Current Configuration

- ✅ `netlify.toml` configured with Next.js plugin
- ✅ `next.config.js` removed static export (using plugin instead)
- ✅ Dynamic routes configured for client-side rendering

## Troubleshooting

### Issue: Build fails with "generateStaticParams" error
**Solution**: Removed `output: 'export'` from `next.config.js`. Use Netlify plugin instead.

### Issue: Dynamic routes return 404
**Solution**: Ensure `@netlify/plugin-nextjs` is installed in Netlify Dashboard.

### Issue: Environment variables not working
**Solution**: Check that `NEXT_PUBLIC_` prefix is used for client-side variables.

## Next Steps

1. ✅ Connect repository to Netlify
2. ✅ Install `@netlify/plugin-nextjs` plugin
3. ✅ Set `NEXT_PUBLIC_API_BASE_URL` environment variable
4. ✅ Deploy

Your Next.js app will now work correctly with dynamic routes!

