# Android API Configuration Guide

## Current Configuration

The Android app is configured to use the Railway production backend:
- **URL**: `https://wilsubmission-production.up.railway.app/api/`
- **Location**: `android/gradle.properties` → `API_BASE_URL`

## How It Works

1. `gradle.properties` defines `API_BASE_URL`
2. `build.gradle.kts` reads it and sets `BuildConfig.API_BASE_URL`
3. `ApiService.kt` uses `BuildConfig.API_BASE_URL` for all API calls

## To Switch Between Backends

### Use Railway (Production) - Current Setting
```properties
API_BASE_URL=https://wilsubmission-production.up.railway.app/api/
```

### Use Local Backend (Development)
For Android Emulator:
```properties
API_BASE_URL=http://10.0.2.2:3000/api/
```

For Physical Device (replace with your computer's IP):
```properties
API_BASE_URL=http://192.168.1.XXX:3000/api/
```

## Important: Rebuild After Changing URL

After changing `gradle.properties`, you **MUST** rebuild the app:

### Option 1: Clean Build (Recommended)
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Option 2: In Android Studio
1. **Build** → **Clean Project**
2. **Build** → **Rebuild Project**
3. Run the app again

## Verify Configuration

After rebuilding, check that `BuildConfig.API_BASE_URL` is correct:
- Add a breakpoint or log statement in `ApiService.kt` line 126
- Or check the generated `BuildConfig.java` file in `app/build/generated/source/buildConfig/`

## Troubleshooting

### Issue: App still uses old URL
**Solution**: Clean and rebuild the project

### Issue: Cannot connect to Railway backend
**Check**:
1. Backend is deployed and running
2. Railway URL is correct (no typos)
3. Network connectivity on device/emulator
4. CORS is configured on backend

### Issue: Certificate/SSL errors
**Solution**: Ensure Railway backend uses HTTPS (it does)

## Current Status

✅ Railway URL is configured: `https://wilsubmission-production.up.railway.app/api/`
⚠️ **App must be rebuilt** for changes to take effect

