import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cityPowerBoqItems } from "./boq-data.js";

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

  // Create initial BOQ for City Power using data from boq-data.ts
  const boqItems = cityPowerBoqItems;

  // Check if BOQ already exists to avoid duplicates on re-seed
  const existingBoq = await prisma.boq.findFirst({
    where: {
      companyId: company.id,
      name: "City Power Initial BOQ",
    },
  });

  if (!existingBoq && boqItems.length > 0) {
    // Create BOQ with version 1
    const boq = await prisma.boq.create({
      data: {
        companyId: company.id,
        name: "City Power Initial BOQ",
        version: 1,
        uploadedBy: admin.id,
        status: "ACTIVE",
        items: {
          create: boqItems.map((item) => ({
            sapNumber: item.sapNumber,
            shortDescription: item.shortDescription,
            unit: item.unit,
            rate: item.rate,
            category: item.category || null,
            searchableText:
              `${item.sapNumber} ${item.shortDescription}`.toLowerCase(),
          })),
        },
      },
    });

    console.log(`Created BOQ with ${boqItems.length} items`);
  } else if (existingBoq) {
    console.log(`BOQ already exists with ID: ${existingBoq.id}`);
  }

  console.log("Seed completed:", {
    company: company.name,
    admin: admin.email,
    field: field.email,
    boqItems: boqItems.length,
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
