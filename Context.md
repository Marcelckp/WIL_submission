## Smart Invoice Capture – Project Plan and Reference

This document captures the agreed plan, architecture, formats, and UX for building an automatic invoice generator used by field operators, with a Node.js server and an admin web portal that manages Bills of Quantities (BOQ). Keep this document as the single source of truth for future tasks and questions.

---

### 1. Goals

- Enable field operators (mobile) to create invoices quickly by searching an approved BOQ and autofilling unit and rate.
- Allow admin/office (web) to upload, validate, and manage BOQs via Excel, and review/export invoices.
- Generate professional PDF tax invoices and store images captured in the field.
- Provide clear validation errors when a spreadsheet is malformed and instructions to fix it.

---

### 2. High-Level Architecture

- Client Apps
  - Android mobile app built with Android Studio (Kotlin), using Room (SQLite) for a local BOQ cache and offline invoice drafts.
  - Web Admin portal (React/Next.js recommended) used by office to upload/validate BOQs, review/approve invoices, and export PDFs.
- Backend Server (Node.js)
  - Express with TypeScript and Zod for validation.
  - Prisma ORM.
  - Database: SQLite for local/dev; Postgres in prod.
  - File storage: Local disk in dev; Azure Blob Storage in prod for invoice PDFs and images (backup/archival).
  - PDF generation: PDFKit (server) for authoritative copy; Android app can also generate a client-side PDF for preview/sharing after approval.
  - Authentication: Email/password with JWT. Roles: ADMIN, FIELD.
  - Concurrency/immutability: once an invoice is approved, it is locked from editing; any change requires a new revision.

---

### 3. Data Model (initial)

- Company
  - id, name, vatNumber, address, logoUrl, createdAt
- User
  - id, companyId (FK), role: ADMIN|FIELD, name, email, passwordHash, active, createdAt
- Boq
  - id, companyId (FK), name, version, uploadedBy (FK User), status: ACTIVE|ARCHIVED, createdAt
- BoqItem
  - id, boqId (FK), sapNumber (string), shortDescription, unit (string), rate (decimal), category (optional), searchableText
- Invoice
  - id, companyId (FK), invoiceNumber (string unique per company), date, customerName, projectSite, preparedBy, subtotal, vatPercent, vatAmount, total, createdBy (FK User), status: DRAFT|SUBMITTED|APPROVED|REJECTED|FINAL, approvedBy (FK User nullable), approvedAt (nullable), rejectionReason (nullable), rejectedAt (nullable), rejectedBy (FK User nullable), serverPdfUrl (nullable), clientPdfUrl (nullable), lastSyncedBoqVersion (nullable)
- InvoiceLine
  - id, invoiceId (FK), boqItemId (nullable), itemName, description (optional), unit, unitPrice (decimal), quantity (decimal), amount (decimal)
- Media

  - id, invoiceId (FK), url, mimeType, width, height, source: CAMERA|GALLERY, storageProvider: AZURE_BLOB, blobContainer, blobPath, createdAt

- Comment
  - id, invoiceId (FK), authorId (FK User), body, createdAt

Notes

- `InvoiceLine` stores a denormalized snapshot of unit, unitPrice, and description for historical consistency even if BOQ changes later.
- Numeric fields use DECIMAL in DB and string in JSON to avoid float rounding in transit.
  - `lastSyncedBoqVersion` saves the BOQ version visible to the device when the draft was created; used for the offline disclaimer.

---

### 4. Excel BOQ Format and Validation

Accepted workbook

- One worksheet named `BOQ` (case-insensitive allowed). Admin UI lets the user choose the sheet if multiple exist.

Required header row (exact, case-insensitive)

- Column A: `SAP #`
- Column B: `SHORT DESCRIPTION`
- Column C: `RATE`
- Column D: `UNIT`

Allowed optional columns

- `CATEGORY` (E) – grouped reporting

Row rules

- Data starts on row 2; no merged cells in the data region.
- `SAP #`: text or number, trimmed, must be unique within the file.
- `SHORT DESCRIPTION`: non-empty text.
- `RATE`: decimal using either comma or dot as decimal separator. We normalize to dot.
- `UNIT`: non-empty short string (e.g., M, M2, M3, EA, HR).

Validation feedback examples

- Missing sheet or wrong header → “Could not find the required columns: SAP #, SHORT DESCRIPTION, RATE, UNIT. Ensure they appear in row 1.”
- Non-numeric `RATE` → “Row 37: RATE must be a number. Found ‘ABC’.”
- Duplicate `SAP #` → “Duplicate SAP # ‘650’ at rows 120 and 187. Make each SAP # unique.”
- Empty mandatory field → “Row 22: SHORT DESCRIPTION is required.”

Import behavior

- Entire file is parsed and validated; failures block import and list all issues.
- On success, a new `Boq` version is created with its `BoqItem`s. Admin can mark a version ACTIVE; only one ACTIVE per company.

---

### 5. REST API (Node.js) – Outline

Auth

- POST /api/auth/login – returns JWT; role in claims

Companies/Settings

- GET /api/company – current company profile
- PATCH /api/company – update VAT, address, logo

BOQ Management

- POST /api/boq/upload – multipart (xlsx). Validates; on success creates new version, returns validation report and counts
- GET /api/boq – list versions
- PATCH /api/boq/:id/activate – set ACTIVE
- GET /api/boq/active/items – search items: `?q=term&limit=20`

Invoices

- POST /api/invoices – create draft (header + optional lines)
- GET /api/invoices – list invoices with optional status filter and pagination
- GET /api/invoices/:id – fetch invoice with lines and media
- PATCH /api/invoices/:id – update header/lines (only when DRAFT)
- POST /api/invoices/:id/submit – move to SUBMITTED; removes all BOQ references, calculates and stores totals, breaks BOQ dependency
- POST /api/invoices/:id/approve – ADMIN only; verifies BOQ independence, generates PDF with all invoice data, uploads to Azure Blob, sets `serverPdfUrl`, marks as FINAL. PDF becomes source of truth.
- POST /api/invoices/:id/reject – ADMIN only; body: `{ reason: string }`; overwrites `rejectionReason`, moves to REJECTED, and sets `rejectedAt`/`rejectedBy`
- POST /api/invoices/:id/media – multipart upload image; returns URL
  - Server streams file to Azure Blob Storage, persists a `Media` row linked to the invoice, and returns `{ mediaId, url }`.
- DELETE /api/invoices/:id/media/:mediaId – remove media
- POST /api/invoices/:id/pdf-preview – optional: return server-rendered preview PDF (DRAFT)
- GET /api/invoices/:id/updates?since=timestamp – polling endpoint returning status and new comments/media refs
  - Designed for 10s polling intervals by both mobile and web; supports long-poll friendly caching headers
- GET /api/invoices/:id/pdf – streams the PDF backup from Azure for download/re-sending (FINAL invoices only). Returns PDF file for download or URL if streaming fails
- GET /api/invoices – filter by date/customer/status with pagination

Utilities

- GET /api/health – readiness/liveness

Request/Response contracts will use Zod schemas. Monetary fields as strings; server uses Decimal.js.

---

### 6. Mobile App – Key Screens and Behavior (Android Native)

Home

- Header: “Smart Invoice Capture”; actions: New Invoice, View Saved
- List recent invoices with status and totals

New Invoice

- Header inputs: invoice date (default: today), customer, project/site, prepared by
- Item section: Add row → item name autocomplete querying local SQLite BOQ cache (Room); autofill unit and unit price; user enters quantity; line amount auto-calculates; totals update live
- Offline banner: “Rates reflect BOQ version v{X} as at {timestamp}. Final invoice rates may update after sync.”
- Photo section: Take/Upload; show thumbnails, remove option
- Buttons: Save (draft), Submit for Approval (uploads draft to server), Back Home

Preview

- Clean summary with company info, customer, items, totals, VAT
- Buttons: Generate PDF (device) after APPROVED, Share via WhatsApp/Email using Android Sharesheet; Edit only when DRAFT/REJECTED

Invoice PDF Viewer (Android)

- After APPROVED, the app fetches the authoritative PDF via `GET /api/invoices/:id/pdf` and displays it in-app using an embedded PDF viewer component.
- If the endpoint returns a signed URL, the viewer streams the file directly; otherwise, it downloads bytes and renders from local cache.
- Users can share or email from the viewer screen.

Offline

- BOQ table fully cached (active version) in SQLite with `lastSyncedAt` and `version` fields
- Drafts cached locally; queued sync when online
- Background polling every ~10s for status/comments via `/updates?since=` endpoint on both Android app and Web UI; exponential backoff when offline

---

### 7. Web Admin Portal – Key Screens

Dashboard

- Stats: Active BOQ, invoices this month, pending drafts

BOQ Upload/Manage

- Upload xlsx → server validates and shows a problems list with exact row/column hints and fix instructions
- Version table with Activate/Archive

Invoices

- Filter/search; open any invoice; view media; comment thread; Approve/Reject
- Approve triggers server-side PDF render and upload to Azure Blob; invoice becomes immutable

Settings

- Company profile, VAT percentage, logo upload, users management

---

### 8. PDF Invoice Template

- Layout mirrors the provided “TAX-INVOICE” sample but modernized: company header with logo and VAT No., client + project block, table of items with Qty, Unit, Rate, Amount, subtotals, VAT, total, and banking details at bottom.
- A4 portrait; fonts: Inter or Roboto; currency: `R` prefix.
- Optional page for embedded thumbnails of evidence photos.
- Two sources: authoritative server PDF (used for archival and email backup) and client PDF (Android) for quick sharing post-approval.

---

### 9. Numbering, Taxes, and Currency

- Invoice numbering per company: `INV-YYYY-####` allocated on finalize to avoid gaps.
- VAT percent stored in company settings; applied on finalize; both `vatAmount` and `total` persisted.
- Currency formatting server-side; locale `en-ZA`.

Immutability and approvals

- Status flow: DRAFT → SUBMITTED → APPROVED (→ FINAL) or REJECTED.
- After APPROVED/FINAL, server prevents edits; new changes require a new invoice.
- Server keeps authoritative PDF in Azure Blob; URL is returned as `serverPdfUrl`.

---

### 10. Security and Access

- JWT auth; HTTP-only cookies on web, bearer token on mobile.
- Role-based guards: FIELD cannot manage BOQs or company settings; ADMIN can do everything.
- File uploads scanned for type/size; max image 10MB; only `image/jpeg`, `image/png`.

---

### 11. Implementation Roadmap (phases)

1. Initialize monorepo, Node server with Express + TypeScript, Prisma, SQLite; scaffolding and CI.
2. BOQ upload + validation + search endpoints; admin UI for upload and versioning.
3. Android app foundation (Kotlin): Room DB schema for BOQ + drafts; data layer; New Invoice screen.
4. Workflow: submit/approve/reject, comments, polling endpoint; server PDF generation and Azure Blob upload; lock on approval.
5. Sharing: Android PDF generation post-approval and system Sharesheet (WhatsApp/Email); email via Intent; optional server-side email.
6. Authentication with roles; company settings.
7. Deployment (Docker), Azure Blob config, backups, and monitoring.

---

### 12. Example BOQ Snippet (normalized)

| SAP # | SHORT DESCRIPTION                             | RATE   | UNIT |
| ----- | --------------------------------------------- | ------ | ---- |
| 10    | Soil dig, backfill, compact hand pickable     | 126.63 | M3   |
| 20    | Soil machine excavate dig, backfill, complete | 143.35 | M3   |
| 80    | Tar paving cut & remove                       | 252.79 | M2   |

Excel may contain comma decimals; the importer converts to dot and validates.

---

### 13. Nice-to-Haves (later)

- Customer directory and per-customer pricing overrides.
- Multiple BOQ catalogs by project with effective dates.
- GPS tagging on photos; map in admin.
- Digital signatures on PDF.

---

### 14. Dev Notes

- Use Decimal.js for all monetary math.
- Use background jobs (BullMQ) for heavy PDF/image processing if needed.
- Keep BOQ search fast with `searchableText` column and DB indices on `(boqId, sapNumber, searchableText)`.
- Android: use WorkManager for background sync/polling; Room for SQLite; Coroutine + Flow for reactive updates.
- Polling cadence tuned to battery/network constraints (default 60s, backoff to 5m when offline).

---

### 15. DevOps Pipeline and Continuous Integration

#### 15.1. Pipeline Overview

Our CI/CD pipeline is designed to ensure **rapid deployment of high-quality application software** by automating quality gates, security scanning, and deployment processes. Every code change triggers automated tests, quality checks, and security scans before any deployment.

#### 15.2. GitHub Actions Workflows

We use separate GitHub Actions workflows under `.github/workflows`:

- **`web-ci.yml`** – builds the web UI (`web/`) with Node 20; runs lint/typecheck/build, SonarQube analysis, and Snyk security scan.
- **`backend-ci.yml`** – builds the Express TypeScript server (`backend/`); generates Prisma client if present; runs lint/typecheck/build/tests, SonarQube analysis, and Snyk security scan.
- **`android-ci.yml`** – builds the Android app (`android/`) using JDK 17 and Gradle (`assembleDebug`); runs SonarQube analysis and Snyk security scan.
- **`play-store-release.yml`** – triggered on GitHub releases; builds signed APK and publishes to Google Play Store automatically.

#### 15.3. Quality Gates

1. **Code Quality (SonarQube)**: Automated code analysis for code smells, bugs, vulnerabilities, and technical debt.
2. **Security Scanning (Snyk)**: Dependency vulnerability scanning and license compliance checks.
3. **Build Verification**: Ensures all components compile without errors.
4. **Test Execution**: Automated test suites run before deployment.

#### 15.4. Pipeline Flow Diagram

```
┌─────────────────┐
│  Code Push/PR   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Trigger GitHub Actions         │
│  (Path-filtered triggers)        │
└────────┬────────────────────────┘
         │
         ├──► Web CI ──────────────┐
         │    ├─ Build             │
         │    ├─ Lint/Typecheck     │
         │    ├─ SonarQube Scan    │
         │    └─ Snyk Security      │
         │                          │
         ├──► Backend CI ───────────┤
         │    ├─ Build             │
         │    ├─ Prisma Generate   │
         │    ├─ Tests             │
         │    ├─ SonarQube Scan    │
         │    └─ Snyk Security      │
         │                          │
         └──► Android CI ───────────┤
              ├─ Gradle Build      │
              ├─ SonarQube Scan    │
              └─ Snyk Security     │
                                    │
                                    ▼
┌───────────────────────────────────────┐
│  Quality Gates Pass?                   │
│  ┌─────────────────────────────┐      │
│  │ ✓ Build Success             │      │
│  │ ✓ SonarQube Quality Gate    │      │
│  │ ✓ Snyk Security Pass         │      │
│  │ ✓ Tests Pass                │      │
│  └─────────────────────────────┘      │
└────────┬──────────────────────────────┘
         │
         ├─ NO ──► Block & Report Issues
         │
         ▼ YES
┌─────────────────────────────────┐
│  Merge to Main / Create Release │
└────────┬───────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  GitHub Release Created?             │
└────────┬───────────────────────────┘
         │
         ▼ YES
┌─────────────────────────────────────┐
│  Play Store Release Workflow        │
│  ├─ Build Signed APK               │
│  ├─ Upload to Play Store           │
│  └─ Version Update                 │
└─────────────────────────────────────┘
```

#### 15.5. Rapid Deployment Strategy

**How the pipeline addresses rapid deployment of high-quality software:**

1. **Automated Quality Checks**: SonarQube scans catch code quality issues early, preventing technical debt accumulation that slows future deployments.
2. **Security-First Approach**: Snyk identifies vulnerabilities before production, reducing post-deployment security patches.
3. **Parallel Execution**: All workflows run in parallel, reducing feedback time from ~15 minutes to ~5 minutes.
4. **Fail-Fast Principle**: First failing quality gate stops the pipeline immediately, saving compute and time.
5. **Automated Play Store Publishing**: On release creation, APK is automatically published, eliminating manual deployment steps and reducing release time from hours to minutes.
6. **Version Consistency**: Automated versioning ensures consistency across web, backend, and mobile releases.

#### 15.6. Team Usage

**Daily Development:**

- Developers push code to feature branches
- PR triggers CI workflows automatically
- Team reviews SonarQube and Snyk reports in PR comments
- Merge only after all quality gates pass

**Release Process:**

1. Merge approved PR to `main`
2. Create GitHub Release with semantic version tag (e.g., `v1.2.3`)
3. Play Store workflow automatically builds and publishes APK
4. Monitor deployment status in GitHub Actions dashboard

**Quality Monitoring:**

- Weekly review of SonarQube dashboards for code quality trends
- Monthly security review using Snyk reports
- Continuous improvement based on pipeline metrics

---

### 16. Immutable Invoices and BOQ Independence

**Critical Design Principle**: Submitted and approved invoices are completely independent of BOQ data to prevent conflicts when BOQ changes over time. The invoice metadata captures all invoice content, and the PDF stored in Azure serves as the authoritative backup that can be re-sent to customers.

**Invoice Lifecycle and BOQ Independence:**

1. **DRAFT Stage:**

   - Invoice lines may reference `boqItemId` for autofill convenience
   - All line data (itemName, unit, unitPrice, quantity, amount) is stored denormalized in `InvoiceLine`
   - Invoice can be edited freely (header and lines can be modified)

2. **SUBMITTED Stage (becomes immutable, breaks BOQ dependency):**

   - When an invoice is submitted, all `boqItemId` references are removed from invoice lines
   - `lastSyncedBoqVersion` is cleared (set to null)
   - All calculations (subtotal, VAT, total) are performed and stored in the invoice record
   - **Immutable metadata snapshot is created** containing:
     - Customer name, project site, prepared by, date
     - Complete list of invoice line items (itemName, description, unit, quantity, unitPrice, amount)
     - Line item count
     - Totals (subtotal, VAT, total)
     - Creation timestamp
   - `metadataSnapshot` (JSON) and `lineItemCount` fields are populated
   - `submittedAt` timestamp is recorded
   - Invoice becomes **immutable** - no edits allowed after submission
   - **No further dependency on BOQ** - all data is captured in invoice lines and metadata

3. **APPROVED/FINAL Stage (PDF becomes authoritative backup):**
   - Invoice is approved by admin
   - PDF is generated containing all invoice data (company info, customer, items, totals, metadata)
   - PDF is uploaded to Azure Blob Storage as the **backup copy**
   - Invoice record stores `serverPdfUrl` pointing to the Azure PDF
   - All `boqItemId` references are verified as null (double-checked)
   - Metadata snapshot is updated with final approved data (invoice number, approval timestamp)
   - **The PDF in Azure is the authoritative backup** that can be re-sent to customers at any time
   - Database record serves as metadata/index for retrieval

**Immutability Enforcement:**

- `PATCH /api/invoices/:id` - Only works for DRAFT invoices, returns 409 error if invoice is already submitted
- Invoice lines cannot be added, modified, or deleted after submission
- All invoice data is frozen at submission time

**Data Storage:**

- `InvoiceLine` stores complete snapshot: `itemName`, `description`, `unit`, `unitPrice`, `quantity`, `amount`
- `Invoice` stores:
  - Basic info: `invoiceNumber`, `date`, `customerName`, `projectSite`, `preparedBy`
  - Financial: `subtotal`, `vatPercent`, `vatAmount`, `total`
  - Status: `status`, `approvedBy`, `approvedAt`, `submittedAt`
  - Backup: `serverPdfUrl` (Azure Blob URL)
  - Metadata: `metadataSnapshot` (JSON with complete invoice content), `lineItemCount`
- All BOQ references (`boqItemId`, `lastSyncedBoqVersion`) are null after submission

**PDF Backup and Re-sending:**

- PDFs are stored in Azure Blob Storage at path: `invoices/{companyId}/{invoiceNumber}.pdf`
- `GET /api/invoices/:id/pdf` - Streams the PDF directly for download/re-sending
- PDF contains all invoice data and can be re-sent to customers at any time
- PDF serves as the permanent, immutable record of what was invoiced

**Benefits:**

- BOQ changes (rates, descriptions) never affect previously submitted/approved invoices
- Historical invoices remain accurate even if BOQ is updated
- PDF preserves invoice state at time of approval and can be re-sent to customers
- Metadata snapshot allows quick querying of invoice content without loading all lines
- System can audit what was actually invoiced vs current BOQ rates
- Complete data independence ensures invoice integrity over time

---

## Changelog

#### 2025-01-XX - Android New Invoice Activity Implementation

- ✅ Completed New Invoice Activity with full functionality:
  - Basic Information form (all fields: Date, Customer, Project/Site, Area, Job No, PO, GRN, Prepared By)
  - BOQ search/autocomplete with filtering
  - Items management (add, delete, calculate totals)
  - Real-time total calculation
  - Photo capture from camera
  - Photo selection from gallery
  - Photo display with delete functionality
  - Save invoice to backend
  - Photo upload to backend
  - Form validation
- ✅ Created InvoiceItemsAdapter for items list
- ✅ Created BoqAutocompleteAdapter with filtering
- ✅ Created PhotoAdapter for photos grid
- ✅ Implemented FileProvider for camera photos
- ✅ Added progress indicators and error handling

#### 2025-01-XX - Android UI Implementation

- ✅ Created comprehensive Android UI based on mockups
- ✅ Implemented Login Activity with authentication
- ✅ Created Dashboard Activity with comprehensive statistics:
  - Total Invoices count
  - Total Amount (sum of all invoices)
  - Total Approved amount
  - Total Draft/Pending amount
  - Most Costly Invoice (highest total)
  - Highest Quantity Invoice (sum of line quantities)
  - Average Invoice Value
  - This Month Invoices count
- ✅ Implemented Invoice List Activity with RecyclerView
- ✅ Created invoice item card layout matching mockup design
- ✅ Added comprehensive resource files (colors, dimens, themes, strings)
- ✅ Implemented SharedPreferencesHelper for authentication persistence
- ✅ Updated API service with invoice list endpoint
- ✅ Created AndroidManifest.xml with all activities
- ⏳ New Invoice Activity (placeholder created, needs full implementation)
- ⏳ Invoice Detail Activity (placeholder created, needs implementation)
- ⏳ BOQ search/autocomplete functionality
- ⏳ Photo capture/upload functionality
- ⏳ Offline mode handling

#### 2025-01-XX - TypeScript & Code Quality Improvements

- ✅ Fixed TypeScript compilation errors by installing `@types/multer`
- ✅ Updated `AuthRequest` interface to include `file` property for multer file uploads
- ✅ Added explicit type annotations to all callback functions
- ✅ Fixed implicit `any` type errors in invoice routes
- ✅ All TypeScript compilation now passes with no errors
- ✅ Applied database migration for invoice metadata fields

#### 2025-01-XX - Invoice Metadata & Immutability

- ✅ Added `metadataSnapshot` (JSON) and `lineItemCount` fields to Invoice model
- ✅ Added `submittedAt` timestamp to track when invoice became immutable
- ✅ Created `createInvoiceMetadataSnapshot()` function to capture complete invoice content
- ✅ Updated submit endpoint to create immutable metadata snapshot and mark invoice as submitted
- ✅ Updated approve endpoint to update metadata snapshot with final approved data
- ✅ Enhanced PDF endpoint to stream PDF from Azure for re-sending to customers
- ✅ Added `streamBlob()` and `downloadBlob()` functions to Azure Blob service
- ✅ Enforced immutability - invoices cannot be edited after submission
- ✅ PDF stored in Azure serves as authoritative backup that can be re-sent
- ✅ Updated documentation to explain metadata, immutability, and PDF backup strategy

#### 2025-01-XX - Invoice BOQ Independence Implementation

- ✅ Updated submit endpoint to remove all BOQ references (`boqItemId`) when invoice is submitted
- ✅ Updated approve endpoint to verify BOQ independence and generate PDF as source of truth
- ✅ Invoice metadata (totals, VAT, items) stored in invoice record upon submission
- ✅ PDF generation captures all invoice data independently of BOQ
- ✅ Clear separation: DRAFT invoices can reference BOQ, SUBMITTED+ invoices are independent
- ✅ Updated documentation to clarify BOQ independence principle

#### 2025-01-XX - Invoice List Display

- ✅ Added GET /api/invoices endpoint to list all invoices with filtering
- ✅ Updated web app invoices page to fetch and display invoice list
- ✅ Added status filter dropdown (All, Draft, Submitted, Approved, Rejected, Final)
- ✅ Added refresh button and error handling
- ✅ Enhanced invoice table with additional columns (Project/Site, Prepared By)
- ✅ Added rejection reason display and PDF view link for approved invoices
- ✅ Improved action buttons with better styling and confirmations

#### 2025-01-XX - Android App & Web Portal Foundation

- ✅ Created Android app structure with Kotlin and Gradle
- ✅ Set up Room database with entities (BoqItemEntity, InvoiceEntity, InvoiceLineEntity)
- ✅ Created DAOs for local data access
- ✅ Implemented Retrofit API service with authentication
- ✅ Created repository layer for data synchronization
- ✅ Built Next.js web admin portal with TypeScript
- ✅ Implemented authentication with Zustand state management
- ✅ Created BOQ upload UI with validation error display
- ✅ Built invoice review dashboard with approve/reject actions
- ✅ Added Tailwind CSS styling

#### 2025-01-XX - Core Backend Completion

- ✅ Integrated Prisma database into all routes (replaced in-memory storage)
- ✅ Implemented media upload endpoint with Azure Blob Storage integration
- ✅ Created PDF invoice generation service using PDFKit
- ✅ Updated approve endpoint to generate PDF and upload to Azure Blob
- ✅ Added company management endpoints
- ✅ Added authentication middleware to all protected routes
- ✅ Implemented role-based access control (ADMIN vs FIELD)
- ✅ Fixed PDF generator async handling

#### 2025-01-XX - Security Fix

- ✅ Replaced vulnerable `xlsx` package (high severity: Prototype Pollution, ReDoS) with `exceljs`
- ✅ Updated BOQ validator to use exceljs async API
- ✅ Updated upload route to handle async validation

#### 2025-01-XX - Authentication & Database Setup

- ✅ Set up Prisma with SQLite database schema (Company, User, Boq, BoqItem, Invoice, InvoiceLine, Media, Comment)
- ✅ Implemented JWT-based authentication with login endpoint (`POST /api/auth/login`)
- ✅ Created authentication middleware for route protection
- ✅ Added role-based access control middleware (ADMIN vs FIELD)
- ✅ Created seed script to initialize test company and users
- ✅ Updated server to include auth routes

#### 2025-01-XX - DevOps & Quality Enhancements

- ✅ Added changelog section to Context.md for tracking all changes
- ✅ Integrated SonarQube code quality scans into all CI workflows (web, backend, Android)
- ✅ Integrated Snyk security vulnerability scanning into all CI workflows
- ✅ Created Play Store publishing workflow (`play-store-release.yml`) triggered on GitHub releases
- ✅ Added comprehensive DevOps pipeline documentation with flow diagrams
- ✅ Documented rapid deployment strategy and team usage guidelines

#### 2025-01-XX - Initial Implementation

- ✅ Initialized Express + TypeScript backend with health endpoint
- ✅ Implemented BOQ upload/validation API with Excel parsing (`xlsx`, `zod` validation)
- ✅ Added invoice workflow endpoints (create, submit, approve, reject, comments, polling)
- ✅ Created GitHub Actions CI workflows for web, backend, and Android builds

---

## Remaining Work

### High Priority

1. **Android App UI Implementation** (Phase 3 - ~60% Complete)

   - ✅ Foundation complete (Room DB, Retrofit, Repository)
   - ✅ Login Screen (fully implemented)
   - ✅ Dashboard Screen (fully implemented with all statistics)
   - ✅ Invoice List Screen (fully implemented)
   - ⏳ Invoice creation screen UI (placeholder exists, needs full implementation)
   - ❌ BOQ item search/autocomplete UI
   - ❌ Photo capture/upload functionality
   - ⏳ Invoice detail view (placeholder exists, needs implementation)
   - ❌ Offline mode handling and disclaimer display
   - ❌ BOQ sync/download from server

2. **Android PDF & Sharing** (Phase 5)

   - ❌ Client-side PDF generation for preview
   - ❌ System Sharesheet integration (WhatsApp/Email)
   - ❌ Email sending via Intent
   - ❌ PDF viewer component for approved invoices

3. **Web Admin Portal Enhancements**

   - ✅ BOQ upload page
   - ✅ Invoice list page
   - ❌ Invoice detail/review page with full line items (critical for approve/reject workflow)
   - ❌ Company settings page (VAT, address, logo upload)
   - ❌ BOQ version management UI (list, activate/deactivate)
   - ❌ Dashboard with statistics (similar to Android dashboard)

4. **Deployment & Infrastructure** (Phase 7)
   - ❌ Docker configuration for backend
   - ❌ Production Azure Blob Storage configuration
   - ❌ Database migration strategy (SQLite → Postgres)
   - ❌ Environment variable management
   - ❌ Monitoring and logging setup
   - ❌ Backup strategy documentation

### Medium Priority

5. **Additional Features**

   - ❌ Invoice comments UI (web and mobile)
   - ❌ Polling implementation for real-time updates (10s intervals)
   - ❌ Invoice detail page for web admin
   - ❌ Export invoices to CSV/Excel
   - ❌ Invoice search/filtering enhancements

6. **Testing**
   - ❌ Unit tests for backend routes
   - ❌ Integration tests for API endpoints
   - ❌ Android app UI tests
   - ❌ E2E tests for critical workflows

### Low Priority (Nice-to-Haves)

7. **Future Enhancements** (from Section 13)
   - Customer directory and per-customer pricing overrides
   - Multiple BOQ catalogs by project with effective dates
   - GPS tagging on photos; map in admin
   - Digital signatures on PDF
   - Invoice revision/versioning system
