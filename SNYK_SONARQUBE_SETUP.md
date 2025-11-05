# Snyk and SonarQube Public Reports Setup

Guide to make Snyk and SonarQube reports publicly accessible via URL.

---

## Snyk Public Reports

### Option 1: Snyk Badge (Public URL)

1. **Go to Snyk Dashboard**: [snyk.io](https://snyk.io)
2. **Select your project**
3. **Click "Settings"** → **"Badge"**
4. **Copy the Badge URL** - This is a public URL showing your project's status
5. **Or use Badge API**:
   ```
   https://snyk.io/test/github/USERNAME/REPO/badge.svg
   ```

### Option 2: Share Snyk Report

1. **Generate Report**:
   ```bash
   snyk test --json > snyk-report.json
   ```

2. **Upload to Public Hosting**:
   - GitHub Gist (for JSON)
   - GitHub Pages (for HTML reports)
   - Or use Snyk's public dashboard links

### Option 3: Public Dashboard Link

1. In Snyk Dashboard → Project Settings
2. Enable "Public Project" (if available)
3. Share the project URL

---

## SonarQube Public Reports

### Option 1: SonarCloud (Recommended - Free Public Reports)

SonarCloud automatically provides public URLs for open-source projects:

1. **Sign up**: [sonarcloud.io](https://sonarcloud.io)
2. **Connect GitHub repo**
3. **Public projects get public URLs automatically**:
   ```
   https://sonarcloud.io/project/overview?id=your-project
   ```

### Option 2: Configure SonarQube Server for Public Access

If using self-hosted SonarQube:

1. **Enable Public Access**:
   - Admin → Configuration → Security
   - Enable "Force authentication" = OFF (for public access)
   - Or create public anonymous access

2. **Share Project URL**:
   ```
   http://your-sonarqube-server.com/dashboard?id=your-project
   ```

### Option 3: SonarQube Badge

1. **Project Dashboard** → **"Get project badges"**
2. **Copy badge URL** (publicly accessible)
3. **Use in README or documentation**

---

## Setup Snyk (If Not Already Configured)

### Install Snyk CLI

```bash
npm install -g snyk
```

### Authenticate

```bash
snyk auth
```

### Test and Generate Report

```bash
cd backend
snyk test --json > snyk-report.json
```

### Add to package.json

```json
{
  "scripts": {
    "snyk:test": "snyk test",
    "snyk:test:json": "snyk test --json > snyk-report.json"
  }
}
```

---

## Setup SonarQube/SonarCloud (If Not Already Configured)

### Option 1: SonarCloud (Free for Public Repos)

1. **Sign up**: [sonarcloud.io](https://sonarcloud.io)
2. **Connect GitHub**
3. **Select repository**
4. **Auto-generates public URL**

### Option 2: SonarQube Server

1. **Install SonarQube** (or use Docker)
2. **Configure project**
3. **Set up public access**

### Create sonar-project.properties

```properties
sonar.projectKey=smart-invoice-backend
sonar.sources=src
sonar.tests=tests
sonar.language=ts
sonar.sourceEncoding=UTF-8
```

---

## GitHub Actions Integration (Automatic Reports)

### Snyk GitHub Action

Create `.github/workflows/snyk.yml`:

```yaml
name: Snyk Security Scan

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * *' # Daily

jobs:
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
```

### SonarCloud GitHub Action

Create `.github/workflows/sonarcloud.yml`:

```yaml
name: SonarCloud

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  sonarcloud:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

---

## Public URL Examples

### Snyk
- Badge: `https://snyk.io/test/github/USERNAME/REPO/badge.svg`
- Dashboard: `https://snyk.io/org/your-org/project/your-project`

### SonarCloud
- Dashboard: `https://sonarcloud.io/project/overview?id=your-project`
- Badge: `https://sonarcloud.io/api/project_badges/measure?project=your-project&metric=coverage`

---

## Quick Setup Commands

### Snyk

```bash
# Install
npm install -g snyk

# Auth
snyk auth

# Test
snyk test

# Monitor (creates dashboard entry)
snyk monitor
```

### SonarCloud

1. Go to [sonarcloud.io](https://sonarcloud.io)
2. Sign up with GitHub
3. Import repository
4. Get public URL automatically

---

## Integration with README

Add badges to your README.md:

```markdown
# Security

[![Snyk](https://snyk.io/test/github/USERNAME/REPO/badge.svg)](https://snyk.io/test/github/USERNAME/REPO)
[![SonarCloud](https://sonarcloud.io/api/project_badges/measure?project=your-project&metric=security_rating)](https://sonarcloud.io/project/overview?id=your-project)
```

---

**Note**: Public reports require either:
- Public repository (SonarCloud free tier)
- Snyk public badge/dashboard
- Or self-hosted solution with public access enabled

