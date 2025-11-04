import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  authenticateToken,
  requireRole,
  AuthRequest,
} from "../middleware/auth.js";
import {
  uploadBlob,
  deleteBlob,
  downloadBlob,
  streamBlob,
} from "../services/firebaseStorage.js";
import { sendInvoiceEmail } from "../services/email.js";
import { generateInvoicePdf } from "../services/pdfGenerator.js";

/**
 * Creates immutable metadata snapshot of invoice content
 * This metadata is independent of BOQ and captures what was actually invoiced
 */
function createInvoiceMetadataSnapshot(invoice: any) {
  return JSON.stringify({
    customerName: invoice.customerName,
    projectSite: invoice.projectSite,
    preparedBy: invoice.preparedBy,
    date: invoice.date,
    lineItemCount: invoice.lines.length,
    items: invoice.lines.map((line: any) => ({
      itemName: line.itemName,
      description: line.description,
      unit: line.unit,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
    })),
    subtotal: invoice.subtotal,
    vatPercent: invoice.vatPercent,
    vatAmount: invoice.vatAmount,
    total: invoice.total,
    createdAt: invoice.createdAt?.toISOString(),
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export const invoicesRouter = Router();

const InvoiceLineSchema = z.object({
  itemName: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().min(1),
  unitPrice: z.string(),
  quantity: z.string(),
  amount: z.string().optional(),
});

const CreateInvoiceSchema = z.object({
  date: z.string(),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  projectSite: z.string().optional(),
  preparedBy: z.string().optional(),
  area: z.string().optional(),
  jobNo: z.string().optional(),
  grn: z.string().optional(),
  po: z.string().optional(),
  address: z.string().optional(),
  lines: z.array(InvoiceLineSchema).optional(),
});

// Create invoice
invoicesRouter.post("/", authenticateToken, async (req: AuthRequest, res) => {
  const parsed = CreateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.issues });
  }

  const data = parsed.data;
  const userId = req.user!.id;
  const companyId = req.user!.companyId;

  try {
    // Generate invoice number for draft invoices
    const year = new Date().getFullYear();
    const count = await prisma.invoice.count({
      where: {
        companyId,
        invoiceNumber: { startsWith: `INV-${year}-` },
      },
    });
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        date: data.date,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        projectSite: data.projectSite,
        preparedBy: data.preparedBy,
        ...(data.area && { area: data.area }),
        ...(data.jobNo && { jobNo: data.jobNo }),
        ...(data.grn && { grn: data.grn }),
        ...(data.po && { po: data.po }),
        ...(data.address && { address: data.address }),
        status: "DRAFT",
        invoiceNumber, // Assign invoice number on creation
        createdBy: userId,
        lines: data.lines
          ? {
              create: data.lines.map((line) => ({
                itemName: line.itemName,
                description: line.description,
                unit: line.unit,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                amount:
                  line.amount ||
                  String(
                    parseFloat(line.quantity) * parseFloat(line.unitPrice)
                  ),
              })),
            }
          : undefined,
      },
      include: { lines: true, comments: { include: { author: true } } },
    });

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({
      error: "Failed to create invoice",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// List invoices
invoicesRouter.get("/", authenticateToken, async (req: AuthRequest, res) => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;

  const where: any = { companyId: req.user!.companyId };

  // Operators only see their own invoices
  if (req.user!.role === "OPERATOR") {
    where.createdBy = req.user!.id;
  }

  if (status) {
    where.status = status;
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        invoiceNumber: true,
        date: true,
        customerName: true,
        customerEmail: true,
        projectSite: true,
        preparedBy: true,
        status: true,
        subtotal: true,
        vatAmount: true,
        total: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        lines: {
          select: {
            id: true,
            itemName: true,
            quantity: true,
            unitPrice: true,
            amount: true,
          },
        },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  res.json({ invoices, total, limit, offset });
});

// Metrics and aggregates for dashboard
invoicesRouter.get(
  "/metrics",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const companyId = req.user!.companyId;
    const where: any = { companyId };

    // Operators only see metrics for their own invoices
    if (req.user!.role === "OPERATOR") {
      where.createdBy = req.user!.id;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        total: true,
        subtotal: true,
        vatPercent: true,
        vatAmount: true,
        status: true,
        createdBy: true,
        customerName: true,
        invoiceNumber: true,
        createdAt: true,
        lines: {
          select: {
            quantity: true,
            unitPrice: true,
            amount: true,
          },
        },
      },
    });

    const parseAmount = (inv: (typeof invoices)[0]): number => {
      // If total exists, use it (already includes VAT)
      if (inv.total) {
        return parseFloat(inv.total);
      }
      // Otherwise calculate from line items and add VAT
      const subtotal = inv.lines.reduce((sum, line) => {
        const qty = parseFloat(line.quantity) || 0;
        const price = parseFloat(line.unitPrice) || 0;
        return sum + qty * price;
      }, 0);

      // Calculate VAT (default 15% if not specified)
      const vatPercent = inv.vatPercent ? parseFloat(inv.vatPercent) : 15;
      const vatAmount = subtotal * (vatPercent / 100);

      // Return total including VAT
      return subtotal + vatAmount;
    };

    let totalRevenue = 0;
    let approvedRevenue = 0;
    let draftPendingRevenue = 0;
    let largestInvoice: any = null;

    const countByOperator: Record<string, number> = {};
    const amountByOperator: Record<string, number> = {};

    for (const inv of invoices) {
      const amount = parseAmount(inv);
      totalRevenue += amount;
      if (inv.status === "FINAL" || inv.status === "APPROVED")
        approvedRevenue += amount;
      if (inv.status === "DRAFT" || inv.status === "SUBMITTED")
        draftPendingRevenue += amount;

      // largest invoice by total
      if (!largestInvoice || amount > largestInvoice.total) {
        largestInvoice = {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          total: amount,
          createdAt: inv.createdAt,
        };
      }

      // operator metrics (by createdBy)
      countByOperator[inv.createdBy] =
        (countByOperator[inv.createdBy] || 0) + 1;
      amountByOperator[inv.createdBy] =
        (amountByOperator[inv.createdBy] || 0) + amount;
    }

    // Fetch operator names
    const operatorIds = Array.from(
      new Set(
        Object.keys(countByOperator).concat(Object.keys(amountByOperator))
      )
    );
    const users = await prisma.user.findMany({
      where: { id: { in: operatorIds } },
      select: { id: true, name: true, email: true },
    });
    const idToUser = Object.fromEntries(users.map((u) => [u.id, u]));

    const topOperatorsByCount = Object.entries(countByOperator)
      .map(([userId, count]) => ({
        userId,
        count: count as number,
        name: idToUser[userId]?.name || idToUser[userId]?.email || "Unknown",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topOperatorsByAmount = Object.entries(amountByOperator)
      .map(([userId, amount]) => ({
        userId,
        amount: amount as number,
        name: idToUser[userId]?.name || idToUser[userId]?.email || "Unknown",
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    res.json({
      totals: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        approvedRevenue: Number(approvedRevenue.toFixed(2)),
        draftPendingRevenue: Number(draftPendingRevenue.toFixed(2)),
        totalCount: invoices.length,
      },
      largestInvoice,
      topOperatorsByCount,
      topOperatorsByAmount,
    });
  }
);

// Email invoice PDF to recipient(s) - Available to both ADMIN and FIELD operators
// Uses invoice.customerEmail if no 'to' is provided
invoicesRouter.post(
  "/:id/email",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { to } = req.body || {};

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.companyId !== req.user!.companyId) {
      return res.sendStatus(404);
    }

    // Only allow sending emails for approved/final invoices
    if (invoice.status !== "FINAL" && invoice.status !== "APPROVED") {
      return res.status(400).json({
        error:
          "Can only send emails for approved invoices. Invoice must be approved first.",
      });
    }

    if (!invoice.serverPdfUrl || !invoice.invoiceNumber) {
      return res.status(400).json({ error: "Invoice PDF not available yet" });
    }

    // Use invoice.customerEmail if no 'to' is provided, or prefer invoice.customerEmail
    const recipientEmail = invoice.customerEmail || to;
    if (!recipientEmail) {
      return res.status(400).json({
        error:
          "No customer email address found on invoice. Please add customer email when creating the invoice.",
      });
    }

    try {
      const pdfFilename = invoice.invoiceNumber + ".pdf";
      const blobContainer = "invoices";
      const blobPath = `invoices/${invoice.companyId}/${pdfFilename}`;
      const result = await sendInvoiceEmail({
        to: Array.isArray(recipientEmail)
          ? recipientEmail
          : String(recipientEmail),
        subject: `Invoice ${invoice.invoiceNumber}`,
        htmlBody: `<p>Please find attached invoice <strong>${invoice.invoiceNumber}</strong>.</p>`,
        pdfBlobContainer: blobContainer,
        pdfBlobPath: blobPath,
      });

      if (result) {
        res.json({ status: "sent", messageId: result.messageId });
      } else {
        res.status(503).json({ error: "Email service not configured" });
      }
    } catch (e) {
      console.error("Manual invoice email send failed:", e);
      res.status(500).json({
        error: "Failed to send email",
        details: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }
);

// Get invoice
invoicesRouter.get("/:id", authenticateToken, async (req: AuthRequest, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      lines: true,
      media: true,
      comments: { include: { author: true } },
      company: true,
    },
  });

  if (!invoice || invoice.companyId !== req.user!.companyId) {
    return res.sendStatus(404);
  }

  // Operators can only access their own invoices
  if (req.user!.role === "OPERATOR" && invoice.createdBy !== req.user!.id) {
    return res.sendStatus(403);
  }

  res.json(invoice);
});

// Update invoice (only DRAFT - immutable after submission)
invoicesRouter.patch(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
    });

    if (!invoice || invoice.companyId !== req.user!.companyId) {
      return res.sendStatus(404);
    }

    // Operators can only update their own invoices
    if (req.user!.role === "OPERATOR" && invoice.createdBy !== req.user!.id) {
      return res.sendStatus(403);
    }

    // Invoice becomes immutable once submitted
    if (invoice.status !== "DRAFT") {
      return res.status(409).json({
        error:
          "Invoice cannot be edited after submission. Only DRAFT invoices can be modified.",
        status: invoice.status,
      });
    }

    try {
      const parsed = CreateInvoiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid request", details: parsed.error.issues });
      }

      const data = parsed.data;

      // Delete existing lines and recreate them
      await prisma.invoiceLine.deleteMany({
        where: { invoiceId: req.params.id },
      });

      const updated = await prisma.invoice.update({
        where: { id: req.params.id },
        data: {
          date: data.date,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          projectSite: data.projectSite,
          preparedBy: data.preparedBy,
          ...(data.area !== undefined && { area: data.area }),
          ...(data.jobNo !== undefined && { jobNo: data.jobNo }),
          ...(data.grn !== undefined && { grn: data.grn }),
          ...(data.po !== undefined && { po: data.po }),
          ...(data.address !== undefined && { address: data.address }),
          lines: data.lines
            ? {
                create: data.lines.map((line) => ({
                  itemName: line.itemName,
                  description: line.description,
                  unit: line.unit,
                  unitPrice: line.unitPrice,
                  quantity: line.quantity,
                  amount:
                    line.amount ||
                    String(
                      parseFloat(line.quantity) * parseFloat(line.unitPrice)
                    ),
                })),
              }
            : undefined,
          // Clear rejection reason when invoice is edited
          rejectionReason: null,
          rejectedAt: null,
          rejectedBy: null,
        },
        include: { lines: true, comments: { include: { author: true } } },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update invoice" });
    }
  }
);

// Submit invoice - breaks BOQ dependency by removing boqItemId references
invoicesRouter.post(
  "/:id/submit",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lines: true },
    });

    if (!invoice || invoice.companyId !== req.user!.companyId) {
      return res.sendStatus(404);
    }

    // Operators can only submit their own invoices
    if (req.user!.role === "OPERATOR" && invoice.createdBy !== req.user!.id) {
      return res.sendStatus(403);
    }

    if (invoice.status !== "DRAFT") {
      return res
        .status(409)
        .json({ error: "Only DRAFT invoices can be submitted" });
    }

    try {
      // Remove BOQ dependency from all invoice lines - ensure all data is captured
      await Promise.all(
        invoice.lines
          .filter((line: { boqItemId: string | null }) => line.boqItemId)
          .map((line: { id: string }) =>
            prisma.invoiceLine.update({
              where: { id: line.id },
              data: { boqItemId: null }, // Remove reference to BOQ
            })
          )
      );

      // Calculate and store totals
      const subtotal = invoice.lines.reduce(
        (sum: number, line: { quantity: string; unitPrice: string }) =>
          sum + parseFloat(line.quantity) * parseFloat(line.unitPrice),
        0
      );
      const vatPercent = parseFloat(invoice.vatPercent || "15");
      const vatAmount = subtotal * (vatPercent / 100);
      const total = subtotal + vatAmount;

      // Create metadata snapshot - captures all invoice data immutably
      const invoiceWithTotals = {
        ...invoice,
        subtotal: subtotal.toFixed(2),
        vatPercent: vatPercent.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        total: total.toFixed(2),
      };
      const metadataSnapshot = createInvoiceMetadataSnapshot(invoiceWithTotals);

      // Update invoice - becomes immutable after submission
      const updated = await prisma.invoice.update({
        where: { id: req.params.id },
        data: {
          status: "SUBMITTED",
          subtotal: subtotal.toFixed(2),
          vatPercent: vatPercent.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          total: total.toFixed(2),
          lastSyncedBoqVersion: null, // Clear BOQ version reference
          metadataSnapshot, // Store immutable snapshot
          lineItemCount: invoice.lines.length,
          submittedAt: new Date(), // Mark submission timestamp
          // Clear rejection fields when resubmitting
          rejectionReason: null,
          rejectedAt: null,
          rejectedBy: null,
        },
        include: { lines: true },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({
        error: "Failed to submit invoice",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Approve invoice (ADMIN only) - generates PDF and uploads to Firebase Storage
// After approval, invoice exists only in PDF form and is completely independent of BOQ
invoicesRouter.post(
  "/:id/approve",
  authenticateToken,
  requireRole("ADMIN"),
  async (req: AuthRequest, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lines: true, company: true },
    });

    if (!invoice || invoice.companyId !== req.user!.companyId) {
      return res.sendStatus(404);
    }

    if (invoice.status !== "SUBMITTED") {
      return res
        .status(409)
        .json({ error: "Only SUBMITTED invoices can be approved" });
    }

    try {
      // Ensure all BOQ references are removed (should already be done on submit, but double-check)
      await Promise.all(
        invoice.lines
          .filter((line: { boqItemId: string | null }) => line.boqItemId)
          .map((line: { id: string }) =>
            prisma.invoiceLine.update({
              where: { id: line.id },
              data: { boqItemId: null },
            })
          )
      );

      // Generate invoice number if not exists
      const year = new Date().getFullYear();
      const count = await prisma.invoice.count({
        where: {
          companyId: invoice.companyId,
          invoiceNumber: { startsWith: `INV-${year}-` },
        },
      });
      const invoiceNumber =
        invoice.invoiceNumber ||
        `INV-${year}-${String(count + 1).padStart(4, "0")}`;

      // Recalculate totals from invoice lines (all data is already captured, no BOQ dependency)
      const subtotal = invoice.lines.reduce(
        (
          sum: number,
          line: { quantity: string | null; unitPrice: string | null }
        ) =>
          sum +
          parseFloat(line.quantity || "0") * parseFloat(line.unitPrice || "0"),
        0
      );
      const vatPercent = parseFloat(
        invoice.vatPercent || (invoice.company.vatNumber ? "15" : "0")
      );
      const vatAmount = subtotal * (vatPercent / 100);
      const total = subtotal + vatAmount;

      // Generate PDF with all invoice data (PDF becomes the authoritative backup)
      const pdfBuffer = await generateInvoicePdf(invoice.id);

      // Upload PDF to Firebase Storage - this serves as the backup that can be re-sent to customers
      const pdfBlobName = `invoices/${invoice.companyId}/${invoiceNumber}.pdf`;
      const pdfUrl = await uploadBlob(
        "invoices",
        pdfBlobName,
        pdfBuffer,
        "application/pdf"
      );

      // Update metadata snapshot with final approved data
      const finalInvoiceData = {
        ...invoice,
        invoiceNumber,
        subtotal: subtotal.toFixed(2),
        vatPercent: vatPercent.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        total: total.toFixed(2),
        serverPdfUrl: pdfUrl,
        approvedAt: new Date(),
        approvedBy: req.user!.id,
      };
      const metadataSnapshot = createInvoiceMetadataSnapshot(finalInvoiceData);

      // Update invoice - store all metadata, remove BOQ references
      // Invoice is now completely immutable and independent
      const updated = await prisma.invoice.update({
        where: { id: req.params.id },
        data: {
          invoiceNumber,
          status: "FINAL",
          subtotal: subtotal.toFixed(2),
          vatPercent: vatPercent.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          total: total.toFixed(2),
          approvedBy: req.user!.id,
          approvedAt: new Date(),
          serverPdfUrl: pdfUrl, // Firebase Storage PDF URL - backup for re-sending
          lastSyncedBoqVersion: null, // Ensure no BOQ version reference
          metadataSnapshot, // Final immutable snapshot
          lineItemCount: invoice.lines.length,
          // Clear rejection fields when approving
          rejectionReason: null,
          rejectedAt: null,
          rejectedBy: null,
        },
        include: { lines: true, comments: { include: { author: true } } },
      });

      // Optionally auto-email on approval when env flag is set
      if (process.env.SEND_EMAIL_ON_APPROVE === "true") {
        // Try to use customer email, fallback to default email
        const to =
          invoice.customerEmail || process.env.DEFAULT_INVOICE_EMAIL_TO;
        if (to) {
          try {
            const pdfFilename = invoiceNumber + ".pdf";
            const blobContainer = "invoices";
            const blobPath = `invoices/${invoice.companyId}/${pdfFilename}`;
            await sendInvoiceEmail({
              to,
              subject: `Invoice ${invoiceNumber}`,
              htmlBody: `<p>Please find attached invoice <strong>${invoiceNumber}</strong>.</p>`,
              pdfBlobContainer: blobContainer,
              pdfBlobPath: blobPath,
            });
          } catch (e) {
            console.error("Auto email on approve failed:", e);
            // Don't fail the approval if email fails
          }
        }
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({
        error: "Failed to approve invoice",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Reject invoice (ADMIN only) - Sets status back to DRAFT so operator can edit
invoicesRouter.post(
  "/:id/reject",
  authenticateToken,
  requireRole("ADMIN"),
  async (req: AuthRequest, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lines: true },
    });

    if (!invoice || invoice.companyId !== req.user!.companyId) {
      return res.sendStatus(404);
    }

    if (invoice.status !== "SUBMITTED") {
      return res
        .status(409)
        .json({ error: "Only SUBMITTED invoices can be rejected" });
    }

    const reason = String(req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    try {
      // Set status back to DRAFT so operator can edit the invoice
      const updated = await prisma.invoice.update({
        where: { id: req.params.id },
        data: {
          status: "DRAFT",
          rejectionReason: reason,
          rejectedBy: req.user!.id,
          rejectedAt: new Date(),
          // Clear totals so they can be recalculated after edits
          subtotal: null,
          vatAmount: null,
          total: null,
        },
        include: { lines: true, comments: { include: { author: true } } },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject invoice" });
    }
  }
);

// Get updates (polling endpoint)
invoicesRouter.get(
  "/:id/updates",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
      },
    });

    if (!invoice || invoice.companyId !== req.user!.companyId) {
      return res.sendStatus(404);
    }

    const since = Number(req.query.since || 0);
    const lastUpdated = invoice.updatedAt.getTime();
    const changed = lastUpdated > since;

    const newComments = invoice.comments.filter(
      (c: { createdAt: Date }) => c.createdAt.getTime() > since
    );

    res.json({
      changed,
      lastUpdatedAt: lastUpdated,
      status: invoice.status,
      comments: newComments,
      serverPdfUrl: invoice.serverPdfUrl,
    });
  }
);

// Add comment
invoicesRouter.post(
  "/:id/comments",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
    });

    if (!invoice || invoice.companyId !== req.user!.companyId) {
      return res.sendStatus(404);
    }

    const body = String(req.body.body || "").trim();
    if (!body) {
      return res.status(400).json({ error: "Comment body is required" });
    }

    try {
      const comment = await prisma.comment.create({
        data: {
          invoiceId: invoice.id,
          authorId: req.user!.id,
          body,
        },
        include: { author: true },
      });

      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create comment" });
    }
  }
);

// Upload media
invoicesRouter.post(
  "/:id/media",
  authenticateToken,
  upload.single("file"),
  async (req: AuthRequest, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
    });

    if (!invoice || invoice.companyId !== req.user!.companyId) {
      return res.sendStatus(404);
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      // Upload to Firebase Storage
      const blobName = `media/${invoice.companyId}/${
        invoice.id
      }/${Date.now()}-${req.file.originalname}`;
      const url = await uploadBlob(
        "media",
        blobName,
        req.file.buffer,
        req.file.mimetype
      );

      // Save media record
      const media = await prisma.media.create({
        data: {
          invoiceId: invoice.id,
          url,
          mimeType: req.file.mimetype,
          source: "GALLERY", // or detect from request
          storageProvider: "FIREBASE_STORAGE",
          blobContainer: "media",
          blobPath: blobName,
        },
      });

      res.status(201).json(media);
    } catch (error) {
      res.status(500).json({
        error: "Failed to upload media",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Delete media
invoicesRouter.delete(
  "/:id/media/:mediaId",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const media = await prisma.media.findUnique({
      where: { id: req.params.mediaId },
      include: { invoice: true },
    });

    if (!media || media.invoice.companyId !== req.user!.companyId) {
      return res.sendStatus(404);
    }

    try {
      // Delete from Firebase Storage
      if (media.blobContainer && media.blobPath) {
        await deleteBlob(media.blobContainer, media.blobPath);
      }

      // Delete from database
      await prisma.media.delete({
        where: { id: req.params.mediaId },
      });

      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete media" });
    }
  }
);

// Get PDF - serves the PDF backup from Firebase Storage as downloadable file
// This allows re-sending the invoice PDF to customers
invoicesRouter.get(
  "/:id/pdf",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
    });

    if (!invoice || invoice.companyId !== req.user!.companyId) {
      return res.sendStatus(404);
    }

    if (!invoice.serverPdfUrl) {
      return res.status(404).json({
        error: "PDF not available. Invoice may not have been approved yet.",
      });
    }

    try {
      // Extract blob path from URL or construct from invoice number
      // serverPdfUrl format: http://.../invoices/{companyId}/{invoiceNumber}.pdf
      const pdfFilename = invoice.invoiceNumber
        ? `${invoice.invoiceNumber}.pdf`
        : `invoice-${invoice.id}.pdf`;

      // Extract blob container and path
      // URL format: {baseUrl}/invoices/{companyId}/{invoiceNumber}.pdf
      const blobContainer = "invoices";
      const blobPath = `invoices/${invoice.companyId}/${pdfFilename}`;

      // Stream PDF from Firebase Storage
      const pdfStream = await streamBlob(blobContainer, blobPath);

      // Set headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${pdfFilename}"`
      );

      // Pipe the stream to response
      pdfStream.pipe(res);
    } catch (error) {
      // If streaming fails, return the URL as fallback
      console.error("Error streaming PDF:", error);
      res.json({
        url: invoice.serverPdfUrl,
        note: "Direct download failed, use URL to access PDF",
      });
    }
  }
);
