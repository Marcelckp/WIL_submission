# Smart Invoice Capture - Web Admin Portal

## Setup Instructions

1. **Install Dependencies**
   ```bash
   cd web
   npm install
   ```

2. **Configure Environment**
   - Create `.env.local` file:
     ```
     NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
     ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   - Opens on http://localhost:3000

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Features

- **Authentication**: Login with admin credentials
- **BOQ Upload**: Upload and validate Excel BOQ files
- **Invoice Review**: View, approve, and reject submitted invoices
- **Dashboard**: Overview of system status

## Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Zustand**: State management
- **Axios**: HTTP client
- **React Query**: Data fetching (ready for integration)

## Project Structure

```
src/
  app/              # Next.js App Router pages
  components/       # Reusable React components
  lib/             # Utilities and API client
  store/           # Zustand state stores
```

## Next Steps

- Implement invoice detail view with comments
- Add real-time polling for invoice updates
- Enhance BOQ version management UI
- Add company settings page
