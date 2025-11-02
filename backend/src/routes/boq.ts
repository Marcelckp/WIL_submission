import { Router } from "express";
import multer from "multer";
import { validateBoqWorkbook } from "../services/boqValidator.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const boqRouter = Router();

// Upload BOQ (ADMIN only)
boqRouter.post("/upload", authenticateToken, requireRole("ADMIN"), upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Field name should be 'file'." });
  }

  try {
    const result = await validateBoqWorkbook(req.file.buffer);
    if (result.issues.length) {
      return res.status(422).json({ status: "invalid", ...result });
    }

    // Deactivate current active BOQ
    await prisma.boq.updateMany({
      where: { companyId: req.user!.companyId, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    // Create new BOQ version
    const latestBoq = await prisma.boq.findFirst({
      where: { companyId: req.user!.companyId },
      orderBy: { version: "desc" },
    });
    const newVersion = (latestBoq?.version || 0) + 1;

    const boq = await prisma.boq.create({
      data: {
        companyId: req.user!.companyId,
        name: `BOQ v${newVersion}`,
        version: newVersion,
        uploadedBy: req.user!.id,
        status: "ACTIVE",
        items: {
          create: result.items.map((item) => ({
            sapNumber: item.sapNumber,
            shortDescription: item.shortDescription,
            unit: item.unit,
            rate: item.rate,
            category: item.category,
            searchableText: `${item.sapNumber} ${item.shortDescription}`.toLowerCase(),
          })),
        },
      },
      include: { items: true },
    });

    return res.json({
      status: "ok",
      version: boq.version,
      boqId: boq.id,
      itemCount: boq.items.length,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to process Excel file",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// List BOQ versions
boqRouter.get("/", authenticateToken, async (req: AuthRequest, res) => {
  const boqs = await prisma.boq.findMany({
    where: { companyId: req.user!.companyId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      name: true,
      version: true,
      status: true,
      createdAt: true,
      uploadedBy: true,
    },
  });

  res.json(boqs);
});

// Activate BOQ version (ADMIN only)
boqRouter.patch("/:id/activate", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const boq = await prisma.boq.findUnique({
    where: { id: req.params.id },
  });

  if (!boq || boq.companyId !== req.user!.companyId) {
    return res.sendStatus(404);
  }

  // Deactivate current active
  await prisma.boq.updateMany({
    where: { companyId: req.user!.companyId, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });

  // Activate selected
  const updated = await prisma.boq.update({
    where: { id: req.params.id },
    data: { status: "ACTIVE" },
  });

  res.json(updated);
});

// Search active BOQ items
boqRouter.get("/active/items", authenticateToken, async (req: AuthRequest, res) => {
  const activeBoq = await prisma.boq.findFirst({
    where: { companyId: req.user!.companyId, status: "ACTIVE" },
    include: { items: true },
  });

  if (!activeBoq) {
    return res.json({ version: 0, items: [] });
  }

  const q = String(req.query.q ?? "").toLowerCase();
  const limit = Math.min(Number(req.query.limit ?? 20), 100);

  let items = activeBoq.items;
  if (q) {
    items = activeBoq.items.filter(
      (i) =>
        i.sapNumber.toLowerCase().includes(q) ||
        i.shortDescription.toLowerCase().includes(q) ||
        i.searchableText?.toLowerCase().includes(q)
    );
  }

  const result = items.slice(0, limit).map((item) => ({
    sapNumber: item.sapNumber,
    shortDescription: item.shortDescription,
    unit: item.unit,
    rate: item.rate,
    category: item.category,
  }));

  res.json({ version: activeBoq.version, items: result });
});
