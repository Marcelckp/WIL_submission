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

// BOQ details (with items, optional search and pagination)
boqRouter.get("/:id", authenticateToken, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const q = String(req.query.q ?? "").toLowerCase();
  const limit = Math.min(Number(req.query.limit ?? 50), 500);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);

  const boq = await prisma.boq.findFirst({
    where: { id, companyId: req.user!.companyId },
    include: { items: true },
  });

  if (!boq) return res.sendStatus(404);

  const itemsAll = boq.items;
  const filtered = q
    ? itemsAll.filter(
        (i) =>
          i.sapNumber.toLowerCase().includes(q) ||
          i.shortDescription.toLowerCase().includes(q) ||
          (i.searchableText?.toLowerCase().includes(q) ?? false) ||
          (i.category?.toLowerCase().includes(q) ?? false) ||
          i.unit.toLowerCase().includes(q) ||
          i.rate.toLowerCase().includes(q)
      )
    : itemsAll;

  const slice = filtered.slice(offset, offset + limit).map((i) => ({
    sapNumber: i.sapNumber,
    shortDescription: i.shortDescription,
    unit: i.unit,
    rate: i.rate,
    category: i.category,
  }));

  res.json({
    id: boq.id,
    name: boq.name,
    version: boq.version,
    status: boq.status,
    createdAt: boq.createdAt,
    uploadedBy: boq.uploadedBy,
    counts: { totalItems: itemsAll.length, filtered: filtered.length },
    items: slice,
    limit,
    offset,
    q,
  });
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

// Export BOQ as CSV (active by default; optional version query)
boqRouter.get("/export", authenticateToken, async (req: AuthRequest, res) => {
  const versionParam = req.query.version ? Number(req.query.version) : undefined;
  const where: any = { companyId: req.user!.companyId };
  if (versionParam) {
    where.version = versionParam;
  } else {
    where.status = "ACTIVE";
  }

  const boq = await prisma.boq.findFirst({ where, include: { items: true }, orderBy: versionParam ? undefined : { version: "desc" } });
  if (!boq) {
    return res.status(404).json({ error: "No BOQ found to export" });
  }

  const header = ["SAP #", "SHORT DESCRIPTION", "RATE", "UNIT", "CATEGORY"]; 
  const lines = boq.items.map((i) => [i.sapNumber, i.shortDescription, i.rate, i.unit, i.category || ""]);

  // Simple CSV serialization with escaping
  const escape = (val: string) => {
    const v = (val ?? "").toString();
    if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  };
  const csv = [header, ...lines].map((row) => row.map(escape).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="boq-v${boq.version}.csv"`
  );
  res.send(csv);
});
