# Android API Configuration Fix

## Issue
The Android app may not be using the correct Railway backend URL even though the code is configured correctly.

## Solution

The code is already configured to use `BuildConfig.API_BASE_URL` which reads from `gradle.properties`. However, **BuildConfig must be regenerated** after any changes.

## Steps to Fix:

### 1. Clean Build (Required)
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### 2. Verify Configuration

**`gradle.properties`** should have:
```properties
API_BASE_URL=https://wilsubmission-production.up.railway.app/api/
```

**`build.gradle.kts`** reads from this and sets:
```kotlin
buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
```

**`ApiService.kt`** uses:
```kotlin
val baseUrl = BuildConfig.API_BASE_URL
```

### 3. Check Logcat After Rebuild

When you run the app, look for these logs:
```
ApiClient: =========================================
ApiClient: Using API Base URL: https://wilsubmission-production.up.railway.app/api/
ApiClient: BuildConfig.API_BASE_URL: https://wilsubmission-production.up.railway.app/api/
ApiClient: =========================================
```

If you see a warning about URL mismatch, the app wasn't rebuilt properly.

### 4. In Android Studio
1. **Build** → **Clean Project**
2. **Build** → **Rebuild Project**
3. **Build** → **Clean Build Folder** (if available)
4. Uninstall the app from emulator
5. Run the app again

## Important Notes

- BuildConfig is generated at **build time**, not runtime
- Changes to `gradle.properties` require a **full rebuild**
- The app must be **uninstalled** from the emulator to clear old BuildConfig values
- Always check Logcat to verify the URL being used

## Verification

After rebuilding, the logs will show the exact URL being used. If it's still wrong, check:
1. `gradle.properties` has the correct URL
2. `build.gradle.kts` is reading from `gradle.properties`
3. BuildConfig was regenerated (check `app/build/generated/source/buildConfig/`)

