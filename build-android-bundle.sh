#!/bin/bash
# Build Android Release AAB for Google Play Store
# Usage: ./build-android-bundle.sh

set -e

echo "🚀 Building Android Release AAB for Play Store..."

# Check if API URL is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide the production API URL"
    echo "Usage: ./build-android-bundle.sh https://your-backend.up.railway.app/api/"
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

# Build release AAB
echo "🔨 Building release AAB..."
./gradlew bundleRelease

# Restore original build.gradle.kts
echo "↩️  Restoring original build.gradle.kts..."
mv app/build.gradle.kts.bak app/build.gradle.kts

# Display output location
AAB_PATH="app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB_PATH" ]; then
    echo "✅ Build successful!"
    echo "📦 AAB location: $AAB_PATH"
    echo "📊 AAB size: $(du -h "$AAB_PATH" | cut -f1)"
    echo ""
    echo "Next steps:"
    echo "1. Upload $AAB_PATH to Google Play Console"
    echo "2. Complete store listing"
    echo "3. Submit for review"
else
    echo "❌ Build failed - AAB not found"
    exit 1
fi

