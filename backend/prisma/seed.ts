/// <reference types="node" />
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { validateBoqCSV } from "../src/services/csvParser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
      name: "Jordan Lee",
      passwordHash: fieldHash,
      role: "FIELD",
      companyId: company.id,
      active: true,
    },
  });

  // Additional field operator users
  const field2Hash = await bcrypt.hash("field123", 10);
  const field2 = await prisma.user.upsert({
    where: { email: "field2@test.com" },
    update: {
      passwordHash: field2Hash,
      active: true,
    },
    create: {
      email: "field2@test.com",
      name: "Alex Johnson",
      passwordHash: field2Hash,
      role: "FIELD",
      companyId: company.id,
      active: true,
    },
  });

  const field3Hash = await bcrypt.hash("field123", 10);
  const field3 = await prisma.user.upsert({
    where: { email: "field3@test.com" },
    update: {
      passwordHash: field3Hash,
      active: true,
    },
    create: {
      email: "field3@test.com",
      name: "Taylor Smith",
      passwordHash: field3Hash,
      role: "FIELD",
      companyId: company.id,
      active: true,
    },
  });

  // Create initial BOQ for City Power using CSV file
  const csvPath = join(__dirname, "city-power-boq.csv");
  let boqItems: Array<{
    sapNumber: string;
    shortDescription: string;
    unit: string;
    rate: string;
    category?: string | null;
  }> = [];

  try {
    const csvContent = readFileSync(csvPath, "utf-8");
    const result = await validateBoqCSV(Buffer.from(csvContent, "utf-8"));
    if (result.issues.length > 0) {
      console.error("CSV validation issues:", result.issues);
      throw new Error(
        `CSV validation failed: ${result.issues.map((i) => i.message).join(", ")}`
      );
    }
    boqItems = result.items;
    console.log(`Loaded ${boqItems.length} BOQ items from CSV`);
  } catch (error) {
    console.error(`Failed to load CSV file from ${csvPath}:`, error);
    console.log("Falling back to TypeScript data import...");
    // Fallback to TypeScript import if CSV fails
    const { cityPowerBoqItems } = await import("./boq-data.js");
    boqItems = cityPowerBoqItems;
  }

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

  // Fix any invoices that have incorrect createdBy references
  // This can happen if the database was reset and users got new IDs
  const invoicesToFix = await prisma.invoice.findMany({
    where: {
      companyId: company.id,
      OR: [{ preparedBy: "Jordan Lee" }, { preparedBy: "Alex Johnson" }],
    },
    select: {
      id: true,
      invoiceNumber: true,
      createdBy: true,
      preparedBy: true,
    },
  });

  let fixedCount = 0;
  for (const inv of invoicesToFix) {
    let correctUserId: string | null = null;

    if (inv.preparedBy === "Jordan Lee" && inv.createdBy !== field.id) {
      correctUserId = field.id;
    } else if (
      inv.preparedBy === "Alex Johnson" &&
      inv.createdBy !== field2.id
    ) {
      correctUserId = field2.id;
    }

    if (correctUserId) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { createdBy: correctUserId },
      });
      fixedCount++;
      console.log(`Fixed invoice ${inv.invoiceNumber} createdBy reference`);
    }
  }

  if (fixedCount > 0) {
    console.log(
      `Fixed ${fixedCount} invoice(s) with incorrect createdBy references`
    );
  }

  console.log("Seed completed:", {
    company: company.name,
    admin: admin.email,
    field: field.email,
    field2: field2.email,
    field3: field3.email,
    boqItems: boqItems.length,
    invoicesFixed: fixedCount,
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
