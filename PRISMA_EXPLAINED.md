# Prisma Explained: Modern Database Toolkit for TypeScript

## What is Prisma?

**Prisma is an ORM (Object-Relational Mapping) tool** for TypeScript and JavaScript. It provides:

1. **Type-safe database client** - Auto-generated based on your schema
2. **Schema definition** - A single source of truth for your database structure
3. **Migrations** - Version-controlled database changes
4. **Introspection** - Generate schema from existing databases
5. **Visual Studio** - GUI to manage your database

**Think of Prisma as a bridge between your code and your database**, making database operations type-safe, developer-friendly, and maintainable.

---

## How Prisma Works: The Big Picture

### The Three-Layer Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                   Your Application                        │
│                                                           │
│  import { PrismaClient } from '@prisma/client'           │
│  const prisma = new PrismaClient()                       │
│  await prisma.user.create({ ... })                       │
│                                                           │
└────────────────────────────┬─────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────┐
│              Prisma Client (Auto-generated)              │
│                                                           │
│  • Type-safe queries                                     │
│  • IntelliSense support                                  │
│  • Query builder                                        │
│  • Connection pooling                                   │
│                                                           │
└────────────────────────────┬─────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────┐
│                    Prisma Schema                          │
│                                                           │
│  • schema.prisma (single source of truth)                │
│  • Models define your tables                             │
│  • Migrations version your changes                       │
│                                                           │
└────────────────────────────┬─────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────┐
│                  Your Database (SQLite,                   │
│                  PostgreSQL, MySQL, etc.)                 │
└──────────────────────────────────────────────────────────┘
```

---

## The Prisma Schema: Your Single Source of Truth

The `schema.prisma` file defines your entire database structure:

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"  // Generate JS/TS client
}

datasource db {
  provider = "sqlite"             // Database type
  url      = "file:./dev.db"     // Connection string
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  createdAt    DateTime @default(now())
  invoices     Invoice[]
  
  @@index([email])
}
```

**What does this do?**

1. **Generator**: Tells Prisma to generate a TypeScript client
2. **Datasource**: Configures database connection
3. **Model**: Defines a database table with fields
4. **Decorators**: `@id`, `@unique`, `@default()` add constraints
5. **Relations**: `invoices Invoice[]` creates a foreign key

### Key Prisma Concepts

#### 1. **Models = Tables**

```prisma
model User {    // This becomes a SQL table
  id String @id // This becomes a column
}
```

Generates:

```sql
CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY
);
```

#### 2. **Fields = Columns**

```prisma
model User {
  email String    // Simple field
  name  String?   // Optional field (? = nullable)
  age   Int       // Integer field
}
```

#### 3. **Relations = Foreign Keys**

```prisma
model User {
  id       String   @id
  invoices Invoice[] // One-to-many relationship
}

model Invoice {
  id     String @id
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```

This creates:

- Foreign key constraint in SQL
- Type-safe queries in code
- Relationship traversal

---

## The Prisma Client: Auto-Generated, Type-Safe Queries

Once you define your schema, Prisma generates a **type-safe client**:

### Generating the Client

```bash
npx prisma generate
```

Creates optimized, type-safe code in `node_modules/.prisma/client/`

### Using the Client

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Now you have full type safety!
await prisma.user.create({
  data: {
    email: "test@example.com",
    name: "Test User",
    passwordHash: "hashed_password"
  }
});

// TypeScript knows all the fields!
const user = await prisma.user.findUnique({
  where: { email: "test@example.com" },
  include: { invoices: true }  // Include related data
});

console.log(user.invoices);  // Type-safe!
```

### Query Building

**Create:**

```typescript
const user = await prisma.user.create({
  data: { email, name, passwordHash }
});
```

**Read:**

```typescript
const users = await prisma.user.findMany({
  where: { active: true },
  include: { company: true }
});
```

**Update:**

```typescript
await prisma.user.update({
  where: { id },
  data: { active: false }
});
```

**Delete:**

```typescript
await prisma.user.delete({
  where: { id }
});
```

**Complex Queries:**

```typescript
// Nested queries
const invoice = await prisma.invoice.findUnique({
  where: { id },
  include: {
    lines: true,      // Get all lines
    media: true,      // Get all photos
    creator: {        // Get creator user
      select: { name: true, email: true }
    }
  }
});

// Aggregations
const stats = await prisma.invoice.aggregate({
  where: { companyId },
  _count: { id: true },
  _sum: { total: true }
});
```

---

## Prisma Migrate: How Migrations Fit In

Now that you understand Prisma basics, here's how migrations work:

### The Workflow

```text
1. Edit schema.prisma
   ↓
2. Create migration: prisma migrate dev
   ↓
3. Prisma generates SQL migration file
   ↓
4. Migration applied to database
   ↓
5. Prisma client regenerated
   ↓
6. Code now matches new schema
```

### Complete Example from Your Project

**Step 1: Define Schema**

```prisma
// prisma/schema.prisma
model Invoice {
  id              String   @id @default(cuid())
  invoiceNumber   String?  @unique
  customerName    String
  status          String
  // ... other fields
  
  // NEW FIELDS:
  metadataSnapshot String?  // Added later
  lineItemCount    Int?
  submittedAt      DateTime?
}
```

**Step 2: Create Migration**

```bash
npx prisma migrate dev --name add_invoice_metadata
```

**Step 3: Prisma Generates SQL**

```sql
-- migrations/20251101135943_add_invoice_metadata/migration.sql
ALTER TABLE "Invoice" ADD COLUMN "metadataSnapshot" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "lineItemCount" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "submittedAt" DATETIME;
```

**Step 4: Migration Applied**

- SQL executed on your database
- Tracking table updated
- Schema migrated ✅

**Step 5: Client Regenerated**

- TypeScript types updated
- Now you can use the new fields!

```typescript
// Now this is valid TypeScript:
await prisma.invoice.update({
  where: { id },
  data: {
    lineItemCount: 10,
    metadataSnapshot: JSON.stringify({...})
  }
});
```

For more details on migrations, see [DATABASE_MIGRATIONS_EXPLAINED.md](./DATABASE_MIGRATIONS_EXPLAINED.md).

---

## Prisma Studio: Visual Database Management

Prisma includes a GUI to view and edit your data:

```bash
npx prisma studio
```

Opens a browser at `http://localhost:5555` with:

- Visual table browser
- Row editor
- Relationship visualizer
- Query builder

---

## Why Use Prisma?

### ✅ Advantages

1. **Type Safety**: Compile-time errors for database queries
2. **Developer Experience**: Auto-completion, IntelliSense
3. **Migration Management**: Version-controlled schema changes
4. **Performance**: Connection pooling, query optimization
5. **Multiple Databases**: Same API for SQLite, PostgreSQL, MySQL, etc.
6. **Modern Syntax**: Clean, intuitive query builder

### ⚠️ Trade-offs

1. **Learning Curve**: Schema syntax, migration workflow
2. **Abstraction**: Less direct SQL control
3. **Generated Code**: Client code in `node_modules`
4. **Extra Layer**: Another abstraction over SQL

---

## Comparing Prisma to Raw SQL

### Raw SQL Approach

```typescript
// No type safety
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// Column names might be wrong, types unknown
console.log(result.rows[0].emial);  // Typo! No error!
```

### Prisma Approach

```typescript
// Full type safety
const user = await prisma.user.findUnique({
  where: { email }
});

// TypeScript catches errors
console.log(user.emial);  // ❌ Compile error!
console.log(user.email);  // ✅ Works!
```

---

## Key Prisma Commands

| Command | Purpose |
|---------|---------|
| `prisma generate` | Generate Prisma Client from schema |
| `prisma migrate dev` | Create migration in development |
| `prisma migrate deploy` | Apply migrations in production |
| `prisma migrate reset` | Drop database and reapply migrations |
| `prisma studio` | Open visual database GUI |
| `prisma db push` | Push schema changes without migration (dev only) |
| `prisma db pull` | Pull schema from existing database |

---

## Common Patterns

### Upsert (Update or Insert)

```typescript
const user = await prisma.user.upsert({
  where: { email },
  update: { name: "Updated Name" },
  create: { 
    email, 
    name: "New User",
    passwordHash,
    companyId 
  }
});
```

### Transactions

```typescript
const result = await prisma.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({ data: {...} });
  await tx.invoiceLine.createMany({ data: lines });
  return invoice;
});
```

### Batch Operations

```typescript
// Create many at once
await prisma.user.createMany({
  data: [
    { email: "user1@example.com", name: "User 1", ... },
    { email: "user2@example.com", name: "User 2", ... },
  ],
  skipDuplicates: true
});

// Update many
await prisma.invoice.updateMany({
  where: { status: "DRAFT" },
  data: { status: "ARCHIVED" }
});
```

---

## In Your Project

Looking at your setup:

**File Structure:**

```
backend/
  prisma/
    schema.prisma           # Schema definition
    migrations/             # Migration history
      migration_lock.toml   # Locks database provider
    seed.ts                 # Seed script
```

**Using Prisma:**

```typescript
// backend/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

**Seed Script:**

```typescript
// backend/prisma/seed.ts
const company = await prisma.company.upsert({
  where: { id: "test-company-1" },
  update: {},
  create: { name: "City Power", ... }
});
```

---

## Key Takeaways

1. **Prisma = Type-safe ORM** for modern TypeScript/JavaScript apps
2. **Schema defines structure** - single source of truth
3. **Client auto-generated** - type-safe queries at compile-time
4. **Migrations version changes** - safe database evolution
5. **Works across databases** - SQLite, PostgreSQL, MySQL, etc.
6. **Developer-friendly** - IntelliSense, auto-completion, clean syntax

---

## Next Steps

- Learn about [Database Migrations](./DATABASE_MIGRATIONS_EXPLAINED.md)
- Read [Prisma Documentation](https://www.prisma.io/docs)
- Explore [Prisma Examples](https://github.com/prisma/prisma-examples)


