# Why Database Migrations Are Versioned and Dated

## The Problem They Solve

**Database migrations** solve a critical problem in software development: **How do you safely evolve your database schema across multiple environments and team members?**

Imagine this scenario:

- Developer A adds a new column to the `User` table
- Developer B creates a new `Invoice` table
- Developer C modifies the `BoqItem` table
- Your production database needs all three changes, in the right order
- Your staging database only has Developer A's change
- Your local database might be missing all changes

**Without migrations, chaos ensues.** With migrations, you get a structured, repeatable way to evolve databases.

---

## What Are Migrations?

A **migration** is a versioned script that changes your database schema. It's like a commit in Git, but for your database structure instead of code.

**Key Idea**: Your database schema is **immutable** - you never edit it directly. Instead, you create **new migrations** that make incremental changes.

---

## Why Timestamps Are Used

### The Naming Convention: `YYYYMMDDHHMMSS_description`

Prisma (and most ORMs) use timestamps like `20251101135943_add_invoice_metadata` because:

**1. Deterministic Ordering:**

```text
20240101000000_create_users_table
20240115000000_add_email_index
20240201000000_create_invoices_table
20251101135943_add_invoice_metadata
```

The timestamps ensure migrations **always run in the correct chronological order**:

- ✅ Same order every time
- ✅ No ambiguity about which comes first
- ✅ Works across all machines

**Without timestamps, you'd have to manually order files**, which is error-prone.

**2. Immutability:**

Timestamps make it impossible to "go back and insert" a migration between two existing ones. This forces you to:

- Think carefully before creating migrations
- Create new migrations for new changes (not edit old ones)
- Maintain a clear history of what changed and when

**3. Team Collaboration:**

When two developers create migrations on the same day:

- `20251101090000_developer_a_adds_field`
- `20251101091500_developer_b_modifies_table`

Even if they created them at the same time, timestamps provide ordering. (In reality, they'd typically merge and Prisma would reorder.)

**4. Descriptive Names + Timestamps:**

The format combines:

- **Timestamp**: Ensures ordering
- **Description**: Makes it readable

```text
20251101135943_add_invoice_metadata
    ↑                ↑
When?          What does it do?
```

---

## The Two-Part System

Every migration has two pieces of information:

### 1. Migration File (SQL)

Contains the **actual database changes**:

```sql
-- migrations/20251101135943_add_invoice_metadata/migration.sql

ALTER TABLE "Invoice" ADD COLUMN "metadataSnapshot" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "lineItemCount" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "submittedAt" DATETIME;
```

### 2. Tracking Table

The database keeps a record of which migrations have been applied:

```sql
-- Your database has a hidden _prisma_migrations table:

Migration Name                      | Applied At                | Started At
------------------------------------+---------------------------+--------------------------
20240101000000_create_users         | 2024-01-01 10:00:00       | 2024-01-01 10:00:00
20240115000000_add_email_index      | 2024-01-15 14:30:00       | 2024-01-15 14:30:00
20251101135943_add_invoice_metadata | 2025-11-01 13:59:43       | 2025-11-01 13:59:43
```

This prevents:

- Running the same migration twice
- Skipping migrations out of order
- Applying migrations that conflict with database state

---

## Why Not Just "Update the Schema"?

You might ask: "Why not just manually run SQL commands on the database?"

### ❌ Manual Approach (Bad)

**Developer Local:**

```sql
ALTER TABLE User ADD COLUMN email TEXT;
```

**Production Database:**

- 🤷 "Did we add that email column?"
- 🤷 "When was it added?"
- 🤷 "What if we need to rollback?"
- 🤷 "What about staging environment?"

**Problems:**

- No history of changes
- Different environments get out of sync
- Can't rollback safely
- Team members have different schemas
- Deploying to production is risky

### ✅ Migration Approach (Good)

**Create Migration:**

```bash
prisma migrate dev --name add_email_to_user
```

**Result:**

- ✅ SQL stored in version control
- ✅ Applied to all environments in same order
- ✅ Can rollback if needed
- ✅ Team sees what changed
- ✅ Production deployment is safe

---

## How Migrations Work Across Environments

### 1. Development

```bash
prisma migrate dev
```

- Generates migration from schema changes
- Applies migration to your local database
- Resets if needed

### 2. Staging

```bash
prisma migrate deploy
```

- Checks which migrations have been applied
- Applies only missing migrations
- Safe for production-like environments

### 3. Production

```bash
prisma migrate deploy
```

- Same as staging
- Checks tracking table
- Applies pending migrations only
- **Never resets data**

---

## Real-World Example

Let's trace your invoice metadata migration:

**Step 1: Schema Change**

```prisma
// schema.prisma
model Invoice {
  // ... existing fields
  metadataSnapshot    String?  // NEW
  lineItemCount       Int?     // NEW
  submittedAt         DateTime? @updatedAt  // NEW
}
```

**Step 2: Create Migration**

```bash
prisma migrate dev --name add_invoice_metadata
```

**Step 3: Files Created**

```text
prisma/
  migrations/
    20251101135943_add_invoice_metadata/
      migration.sql  # The SQL to apply
```

**Step 4: Migration Applied**

```sql
-- Prisma executes migration.sql:
ALTER TABLE "Invoice" ADD COLUMN "metadataSnapshot" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "lineItemCount" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "submittedAt" DATETIME;
```

**Step 5: Tracking Updated**

```sql
INSERT INTO _prisma_migrations VALUES (
  '20251101135943_add_invoice_metadata',
  '...hash...',
  '2025-11-01 13:59:43'
);
```

**Step 6: Deploy**

- Your teammate pulls code
- Runs `prisma migrate deploy`
- Sees: "Found 1 migration to apply"
- Applies it
- Database is now in sync

---

## Why Timestamps, Not Sequential Numbers?

You might wonder: "Why not use `001`, `002`, `003` instead of timestamps?"

### Problem with Sequential Numbers:

```text
migrations/
  001_create_users.sql       ← Created by Dev A at 10:00
  002_add_indexes.sql        ← Created by Dev B at 09:55 (but committed later!)
  003_create_invoices.sql    ← Created by Dev C at 10:05
```

**Issue:** `002` was created BEFORE `001` but has a higher number!

With timestamps:

```text
migrations/
  20241101095500_add_indexes.sql      ← 09:55
  20241101100000_create_users.sql     ← 10:00
  20241101100500_create_invoices.sql  ← 10:05
```

**Correct chronological order** regardless of when files were committed!

---

## Other ORMs Use Similar Approaches

- **Django** (Python): `0001_initial.py`, `0002_add_field.py` (auto-incrementing)
- **Rails** (Ruby): `20241101135943_create_users.rb` (timestamps)
- **Sequelize** (JS): `20241101135943-create-users.js` (timestamps)
- **EF Core** (C#): `20241101135943_AddField.cs` (timestamps)
- **Alembic** (Python SQLAlchemy): `abc123def456_add_column.py` (hashes)

**Timestamps are the most common** because they provide natural ordering.

---

## Key Takeaways

1. **Migrations provide version control for your database schema**
2. **Timestamps ensure deterministic ordering** across all environments
3. **Each migration is immutable** - never edit old migrations
4. **Tracking table prevents duplicate application**
5. **Safe deployment** across dev → staging → production
6. **Enables rollback** and clear history
7. **Team collaboration** without conflicts

---

## Best Practices

✅ **Do:**

- Create descriptive migration names
- Keep migrations small and focused
- Test migrations in staging first
- Commit migration files to version control

❌ **Don't:**

- Edit old migration files
- Skip migrations in production
- Delete migration history
- Mix data changes with schema changes

---

## In Your Prisma Project

Looking at your project:

```text
backend/prisma/migrations/
  20251101135943_add_invoice_metadata/
    migration.sql    # Contains SQL ALTER statements

  migration_lock.toml  # Locks Prisma to SQLite provider
```

This migration added metadata fields to your `Invoice` table. When you:

- Deploy to production
- Share with teammates
- Set up a new environment

All will apply this migration in the same order, ensuring your database schema stays consistent everywhere.

---

## How Migrations Relate to Prisma

**Prisma** provides the migration system, but the concepts apply to all ORMs:

1. **Define schema** in `schema.prisma` (or similar)
2. **Generate migration** from schema differences
3. **Apply migration** in order using timestamps
4. **Track applied migrations** in database table

For more about Prisma itself, see [PRISMA_EXPLAINED.md](./PRISMA_EXPLAINED.md).

---

## Migration States

A migration can be in one of these states:

1. **Pending**: Created but not yet applied to any environment
2. **Applied**: Successfully executed in at least one environment
3. **Failed**: Attempted but encountered an error
4. **Rolled Back**: Applied and then reversed (advanced)

The tracking table keeps record of all these states across environments.

---

## Advanced Topics

### Data Migrations vs Schema Migrations

**Schema Migration:**

```sql
ALTER TABLE User ADD COLUMN email TEXT;
```

**Data Migration:**

```sql
UPDATE User SET email = LOWER(name) || '@example.com' WHERE email IS NULL;
```

**Best Practice**: Separate data migrations from schema migrations for easier management.

### Rollback Strategies

While Prisma doesn't provide automatic rollbacks, you can:

1. Create a new migration that reverses changes
2. Manually write SQL to undo changes
3. Use version control to track before/after states

### Multi-Database Strategies

For complex systems with multiple databases:

- Keep migrations separate per database
- Use consistent naming across systems
- Coordinate schema changes across databases

---

## Summary

Database migrations are **essential for modern database management**. They provide:

- **Version control** for your schema
- **Reproducible changes** across environments
- **Team collaboration** without conflicts
- **Safe deployments** to production
- **Clear history** of what changed and when

The timestamp-based naming convention ensures **deterministic ordering** and **immutability**, making migrations reliable and predictable across all environments.
