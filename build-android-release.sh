#!/bin/bash
# Build Android Release APK for Production
# Usage: ./build-android-release.sh

set -e

echo "🚀 Building Android Release APK..."

# Check if API URL is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide the production API URL"
    echo "Usage: ./build-android-release.sh https://your-backend.up.railway.app/api/"
    exit 1
fi

API_URL="$1"

# Ensure URL ends with /
if [[ ! "$API_URL" =~ /$ ]]; then
    API_URL="$API_URL/"
fi

echo "📱 API URL: $API_URL"

# Navigate to android directory
cd "$(dirname "$0")/android"

# Update build.gradle.kts with production API URL
echo "✏️  Updating API URL in build.gradle.kts..."
sed -i.bak "s|buildConfigField(\"String\", \"API_BASE_URL\",.*|buildConfigField(\"String\", \"API_BASE_URL\", \"\\\"$API_URL\\\"\")|" app/build.gradle.kts

# Clean previous builds
echo "🧹 Cleaning previous builds..."
./gradlew clean

# Build release APK
echo "🔨 Building release APK..."
./gradlew assembleRelease

# Restore original build.gradle.kts
echo "↩️  Restoring original build.gradle.kts..."
mv app/build.gradle.kts.bak app/build.gradle.kts

# Display output location
APK_PATH="app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    echo "✅ Build successful!"
    echo "📦 APK location: $APK_PATH"
    echo "📊 APK size: $(du -h "$APK_PATH" | cut -f1)"
else
    echo "❌ Build failed - APK not found"
    exit 1
fi

