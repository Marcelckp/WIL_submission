import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create a test company
  const company = await prisma.company.upsert({
    where: { id: "test-company-1" },
    update: {},
    create: {
      id: "test-company-1",
      name: "City Power",
      vatNumber: "4710191182",
      address: "Johannesburg, South Africa",
    },
  });

  // Create admin user
  const adminHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {
      passwordHash: adminHash,
      active: true,
    },
    create: {
      email: "admin@test.com",
      name: "Admin User",
      passwordHash: adminHash,
      role: "ADMIN",
      companyId: company.id,
      active: true,
    },
  });

  // Create field operator user
  const fieldHash = await bcrypt.hash("field123", 10);
  const field = await prisma.user.upsert({
    where: { email: "field@test.com" },
    update: {
      passwordHash: fieldHash,
      active: true,
    },
    create: {
      email: "field@test.com",
      name: "Field Operator",
      passwordHash: fieldHash,
      role: "FIELD",
      companyId: company.id,
      active: true,
    },
  });

  console.log("Seed completed:", {
    company: company.name,
    admin: admin.email,
    field: field.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
