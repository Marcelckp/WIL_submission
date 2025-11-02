# Technical Guides

This directory contains technical documentation to help understand key concepts in this project.

## Available Guides

### 1. **Prisma Explained** ([PRISMA_EXPLAINED.md](./PRISMA_EXPLAINED.md))

Learn about Prisma, the modern database toolkit for TypeScript:

- What Prisma is and how it works
- Schema definition and models
- Auto-generated type-safe client
- Query building and patterns
- Prisma Studio and tools
- Advantages and trade-offs

**Read this if**: You want to understand how database queries work in this project.

### 2. **Database Migrations Explained** ([DATABASE_MIGRATIONS_EXPLAINED.md](./DATABASE_MIGRATIONS_EXPLAINED.md))

Understand why migrations are versioned and dated:

- What migrations are and why we need them
- Why timestamps are used for naming
- How migrations work across environments
- Migration lifecycle and tracking
- Best practices and patterns

**Read this if**: You want to understand database schema evolution and version control.

### 3. **Event Loop Explained** ([EVENT_LOOP_EXPLANATION.md](./EVENT_LOOP_EXPLANATION.md))

Deep dive into event loops and async programming:

- What event loops are
- How `await` and yielding control works
- Single-threaded vs multi-threaded event loops
- JavaScript/Node.js event loop
- Python asyncio coroutines
- Java Netty and Rust Tokio

**Read this if**: You want to understand async programming, concurrency, and event-driven architectures.

---

## Quick Reference

### Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create migration in development
npx prisma migrate dev --name your_migration_name

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio (GUI)
npx prisma studio

# Reset database (dev only)
npx prisma migrate reset
```

### Migration Workflow

```bash
# 1. Edit schema.prisma
# 2. Create and apply migration
npx prisma migrate dev --name descriptive_name

# 3. Commit migration files to git
git add prisma/migrations prisma/schema.prisma
git commit -m "Add migration: descriptive_name"
```

---

## Project Structure

```
backend/
  prisma/
    schema.prisma              # Database schema definition
    migrations/                # Migration history
      20251101135943_*/        # Timestamped migrations
      migration_lock.toml      # Locks database provider
    seed.ts                    # Seed data script
  src/
    lib/
      prisma.ts               # Prisma client instance
    routes/                    # API routes using Prisma
    services/                  # Business logic using Prisma
```

---

## Key Concepts Quick Links

- **What is Prisma?** → [PRISMA_EXPLAINED.md](./PRISMA_EXPLAINED.md#what-is-prisma)
- **Why use timestamps for migrations?** → [DATABASE_MIGRATIONS_EXPLAINED.md](./DATABASE_MIGRATIONS_EXPLAINED.md#why-timestamps-are-used)
- **How does `await` work?** → [EVENT_LOOP_EXPLANATION.md](./EVENT_LOOP_EXPLANATION.md#understanding-await-and-yielding-control)
- **What's the difference between coroutines and promises?** → [EVENT_LOOP_EXPLANATION.md](./EVENT_LOOP_EXPLANATION.md#javascriptpromise-execution-details)

---

## Further Reading

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Examples](https://github.com/prisma/prisma-examples)
- [Node.js Event Loop](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/)
- [Python asyncio](https://docs.python.org/3/library/asyncio.html)


