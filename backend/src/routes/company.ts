import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

export const companyRouter = Router();

const UpdateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

// Get company profile
companyRouter.get("/", authenticateToken, async (req: AuthRequest, res) => {
  const company = await prisma.company.findUnique({
    where: { id: req.user!.companyId },
  });

  if (!company) {
    return res.sendStatus(404);
  }

  res.json(company);
});

// Update company (ADMIN only)
companyRouter.patch("/", authenticateToken, async (req: AuthRequest, res) => {
  if (req.user!.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const parsed = UpdateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
  }

  try {
    const updated = await prisma.company.update({
      where: { id: req.user!.companyId },
      data: parsed.data,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update company" });
  }
});

