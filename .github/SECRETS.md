# Required GitHub Secrets

This document lists all GitHub Secrets required for CI/CD workflows to function properly.

## Code Quality & Security Scanning

### SonarQube

- **`SONAR_TOKEN`**: SonarQube authentication token (generate from SonarQube project settings)
- **`SONAR_HOST_URL`**: SonarQube server URL (e.g., `https://sonarcloud.io` or your self-hosted instance)

### Snyk

- **`SNYK_TOKEN`**: Snyk authentication token (available from https://app.snyk.io/account after creating a Snyk account)

## Play Store Publishing

### Android Keystore

- **`ANDROID_KEYSTORE_BASE64`**: Base64-encoded keystore file (JKS) for signing release APKs/AABs
- **`ANDROID_KEYSTORE_PASSWORD`**: Password for the keystore
- **`ANDROID_KEY_ALIAS`**: Key alias name within the keystore
- **`ANDROID_KEY_PASSWORD`**: Password for the signing key

### Google Play API

- **`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`**: JSON content of Google Play Service Account credentials
  - Create a service account in Google Play Console → Setup → API access
  - Grant "Release apps to production" permission
  - Download JSON key file and paste entire contents as secret

## Setup Instructions

1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret listed above with its corresponding value
4. Secrets are encrypted and only accessible during workflow execution

## Notes

- All scanning workflows use `continue-on-error: true` to prevent blocking builds on quality/security warnings
- Play Store workflow only runs on GitHub Releases; manual trigger is also possible
- Keystore secrets are required only if you plan to publish to Play Store
