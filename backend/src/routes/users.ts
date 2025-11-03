import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

export const usersRouter = Router();

// List users (optionally filter by role)
usersRouter.get("/", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const role = (req.query.role as string) || undefined;
  const users = await prisma.user.findMany({
    where: { companyId: req.user!.companyId, ...(role ? { role } : {}) },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

// Admin-triggered password reset: sets a temporary password and returns it for distribution
usersRouter.post("/:id/reset-password", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.companyId !== req.user!.companyId) return res.sendStatus(404);

  const tempPassword = Math.random().toString(36).slice(-10); // simple temp password
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  res.json({ userId: id, tempPassword });
});


