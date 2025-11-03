# Environment Variables

Use these templates to create `.env` files locally.

## Backend (`backend/.env`)

```
PORT=3000
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me"

# Azure Blob Storage (required in production for PDFs/media)
AZURE_STORAGE_ACCOUNT="your-account"
AZURE_STORAGE_KEY="your-key"
AZURE_BLOB_CONTAINER_INVOICES="invoices"
```

## Web (`web/.env.local`)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
PORT=3001
```

> Note: Some environments block committing `.env` files. Use this document to copy the correct values.
