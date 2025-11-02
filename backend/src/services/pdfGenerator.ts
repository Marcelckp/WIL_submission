import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma.js";

/**
 * Generates PDF invoice from invoice data.
 * NOTE: This function uses ONLY invoice metadata and invoice lines - NO BOQ dependency.
 * All data is self-contained in the invoice record (itemName, unitPrice, quantity, etc.)
 * The PDF is the authoritative source of truth for approved invoices.
 */
export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      company: true,
      lines: true, // Invoice lines contain all data independently of BOQ
      media: true,
      creator: true,
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers: Buffer[] = [];

  doc.on("data", (chunk) => buffers.push(chunk));

  // Header
  doc.fontSize(20).text("TAX INVOICE", { align: "right" });
  doc.moveDown();

  // Company info
  if (invoice.company.name) {
    doc.fontSize(14).text(invoice.company.name, { continued: false });
  }
  if (invoice.company.vatNumber) {
    doc.fontSize(10).text(`VAT NO: ${invoice.company.vatNumber}`);
  }
  if (invoice.company.address) {
    doc.fontSize(10).text(invoice.company.address);
  }
  doc.moveDown();

  // Invoice details
  doc.fontSize(10);
  doc.text(`DATE: ${invoice.date}`, { continued: true });
  doc.text(`INVOICE NO: ${invoice.invoiceNumber || "Pending"}`, {
    align: "right",
  });
  doc.text(`AREA:`, { continued: true });
  doc.text(`JOB NO:`, { align: "right" });
  doc.text(`PO:`, { continued: true });
  doc.text(`GRN:`, { align: "right" });
  doc.text(`ADDRESS:`, { continued: true });
  doc.text(`CLIENT: ${invoice.customerName}`, { align: "right" });
  doc.moveDown();

  // Items table
  doc.fontSize(10);
  const tableTop = doc.y;
  const itemStartX = 50;
  const descStartX = 150;
  const qtyStartX = 350;
  const unitStartX = 400;
  const rateStartX = 450;
  const amountStartX = 500;

  // Headers
  doc.font("Helvetica-Bold");
  doc.text("Item", itemStartX, tableTop);
  doc.text("Description", descStartX, tableTop);
  doc.text("Qty", qtyStartX, tableTop);
  doc.text("Unit", unitStartX, tableTop);
  doc.text("Rate", rateStartX, tableTop);
  doc.text("Amount", amountStartX, tableTop);
  doc.moveDown(0.5);

  // Table lines
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.3);

  // Items
  doc.font("Helvetica");
  let currentY = doc.y;
  invoice.lines.forEach((line) => {
    if (currentY > 700) {
      // New page if needed
      doc.addPage();
      currentY = 50;
    }

    const qty = parseFloat(line.quantity || "0");
    const rate = parseFloat(line.unitPrice || "0");
    const amount = qty * rate;

    doc.text(line.itemName, itemStartX, currentY, { width: 100 });
    doc.text(line.description || line.itemName, descStartX, currentY, {
      width: 190,
    });
    doc.text(qty.toFixed(2), qtyStartX, currentY, { width: 40 });
    doc.text(line.unit, unitStartX, currentY, { width: 40 });
    doc.text(`R ${rate.toFixed(2)}`, rateStartX, currentY, { width: 50 });
    doc.text(`R ${amount.toFixed(2)}`, amountStartX, currentY, { width: 50 });

    currentY += 20;
    doc.y = currentY;
  });

  doc.moveDown(1);

  // Totals
  const subtotal = invoice.lines.reduce(
    (sum, line) =>
      sum +
      parseFloat(line.quantity || "0") * parseFloat(line.unitPrice || "0"),
    0
  );
  const vatPercent = parseFloat(invoice.vatPercent || "15");
  const vatAmount = subtotal * (vatPercent / 100);
  const total = subtotal + vatAmount;

  doc.font("Helvetica-Bold");
  doc.text(`SUB-TOTAL R ${subtotal.toFixed(2)}`, { align: "right" });
  doc.text(`VAT R ${vatAmount.toFixed(2)}`, { align: "right" });
  doc.text(`TOTAL R ${total.toFixed(2)}`, { align: "right" });

  doc.moveDown(2);

  // Banking details
  if (invoice.company.address) {
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Banking Details", { align: "center" });
    doc.font("Helvetica");
    doc.text(invoice.company.address);
  }

  doc.end();

  // Wait for PDF to be generated
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on("error", reject);
  });
}
