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

  // Header - TAX INVOICE
  doc.fontSize(24).font("Helvetica-Bold").text("TAX INVOICE", { align: "right" });
  doc.moveDown(0.5);

  // Company info (left side)
  doc.fontSize(14).font("Helvetica-Bold");
  if (invoice.company.name) {
    doc.text(invoice.company.name, { continued: false });
  }
  doc.fontSize(10).font("Helvetica");
  if (invoice.company.vatNumber) {
    doc.text(`VAT NO: ${invoice.company.vatNumber}`);
  }
  if (invoice.company.address) {
    doc.text(invoice.company.address);
  }
  doc.moveDown(1);

  // Invoice details - Two column layout
  doc.fontSize(10);
  const leftColumnX = 50;
  const rightColumnX = 350;
  let currentY = doc.y;

  // Left column
  doc.text(`DATE: ${invoice.date}`, leftColumnX, currentY);
  currentY += 18;
  
  if (invoice.area) {
    doc.text(`AREA: ${invoice.area}`, leftColumnX, currentY);
    currentY += 18;
  } else {
    doc.text(`AREA:`, leftColumnX, currentY);
    currentY += 18;
  }
  
  if (invoice.po) {
    doc.text(`PO: ${invoice.po}`, leftColumnX, currentY);
    currentY += 18;
  } else {
    doc.text(`PO:`, leftColumnX, currentY);
    currentY += 18;
  }
  
  if (invoice.address) {
    doc.text(`ADDRESS: ${invoice.address}`, leftColumnX, currentY, { width: 280 });
  } else {
    doc.text(`ADDRESS:`, leftColumnX, currentY);
  }

  // Right column
  currentY = doc.y - (invoice.area ? 54 : invoice.po ? 36 : 18);
  const invoiceNumber = invoice.invoiceNumber || "Pending";
  doc.text(`INVOICE NO: ${invoiceNumber}`, rightColumnX, currentY, { align: "right", width: 200 });
  currentY += 18;
  
  if (invoice.jobNo) {
    doc.text(`JOB NO: ${invoice.jobNo}`, rightColumnX, currentY, { align: "right", width: 200 });
    currentY += 18;
  } else {
    doc.text(`JOB NO:`, rightColumnX, currentY, { align: "right", width: 200 });
    currentY += 18;
  }
  
  if (invoice.grn) {
    doc.text(`GRN: ${invoice.grn}`, rightColumnX, currentY, { align: "right", width: 200 });
    currentY += 18;
  } else {
    doc.text(`GRN:`, rightColumnX, currentY, { align: "right", width: 200 });
    currentY += 18;
  }
  
  doc.text(`CLIENT: ${invoice.customerName}`, rightColumnX, currentY, { align: "right", width: 200 });

  // Move to next section
  doc.y = Math.max(doc.y, currentY + 10);
  doc.moveDown(1);

  // Items table
  doc.fontSize(10);
  const tableTop = doc.y;
  const itemStartX = 50;
  const descStartX = 150;
  const qtyStartX = 350;
  const unitStartX = 400;
  const rateStartX = 450;
  const amountStartX = 500;
  const tableWidth = 500;

  // Headers
  doc.font("Helvetica-Bold");
  doc.text("Item", itemStartX, tableTop);
  doc.text("Description", descStartX, tableTop);
  doc.text("Qty", qtyStartX, tableTop, { width: 40, align: "right" });
  doc.text("Unit", unitStartX, tableTop, { width: 40 });
  doc.text("Rate", rateStartX, tableTop, { width: 50, align: "right" });
  doc.text("Amount", amountStartX, tableTop, { width: 50, align: "right" });
  
  // Horizontal line under headers
  doc.moveTo(itemStartX, tableTop + 12).lineTo(itemStartX + tableWidth, tableTop + 12).stroke();
  doc.y = tableTop + 20;

  // Items
  doc.font("Helvetica");
  let currentYPos = doc.y;
  invoice.lines.forEach((line) => {
    // Check if we need a new page
    if (currentYPos > 650) {
      doc.addPage();
      currentYPos = 50;
    }

    const qty = parseFloat(line.quantity || "0");
    const rate = parseFloat(line.unitPrice || "0");
    const amount = qty * rate;

    // Calculate height needed for this row (handle wrapping)
    const itemHeight = Math.max(
      20,
      doc.heightOfString(line.itemName, { width: 90 }) + 4,
      doc.heightOfString(line.description || line.itemName, { width: 180 }) + 4
    );

    // Draw item row
    doc.text(line.itemName, itemStartX, currentYPos, { width: 90 });
    doc.text(line.description || line.itemName, descStartX, currentYPos, { width: 180 });
    doc.text(qty.toFixed(2), qtyStartX, currentYPos, { width: 40, align: "right" });
    doc.text(line.unit, unitStartX, currentYPos, { width: 40 });
    doc.text(`R ${rate.toFixed(2)}`, rateStartX, currentYPos, { width: 50, align: "right" });
    doc.text(`R ${amount.toFixed(2)}`, amountStartX, currentYPos, { width: 50, align: "right" });

    currentYPos += itemHeight;
    doc.y = currentYPos;
  });

  // Horizontal line after items
  doc.moveTo(itemStartX, currentYPos + 5).lineTo(itemStartX + tableWidth, currentYPos + 5).stroke();
  doc.y = currentYPos + 15;

  // Totals section
  const subtotal = invoice.lines.reduce(
    (sum, line) =>
      sum +
      parseFloat(line.quantity || "0") * parseFloat(line.unitPrice || "0"),
    0
  );
  const vatPercent = parseFloat(invoice.vatPercent || "15");
  const vatAmount = subtotal * (vatPercent / 100);
  const total = subtotal + vatAmount;

  // Align totals with Amount column
  // Amount column: X = 500, width = 50, right-aligned
  // Put labels on the left, amounts aligned with Amount column
  const labelX = 400; // Start position for labels
  const amountX = amountStartX; // Same X as Amount column (500)
  const amountWidth = 50; // Same width as Amount column

  doc.font("Helvetica-Bold");
  doc.fontSize(10);
  const totalsY = doc.y;
  
  // SUB-TOTAL
  doc.text("SUB-TOTAL", labelX, totalsY);
  doc.text(`R ${subtotal.toFixed(2)}`, amountX, totalsY, { width: amountWidth, align: "right" });
  
  // VAT
  doc.text(`VAT (${vatPercent}%)`, labelX, totalsY + 18);
  doc.text(`R ${vatAmount.toFixed(2)}`, amountX, totalsY + 18, { width: amountWidth, align: "right" });
  
  // TOTAL
  doc.fontSize(12);
  doc.text("TOTAL", labelX, totalsY + 36);
  doc.text(`R ${total.toFixed(2)}`, amountX, totalsY + 36, { width: amountWidth, align: "right" });
  
  doc.y = totalsY + 54;
  doc.moveDown(2);

  // Banking details
  if (invoice.company.address) {
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Banking Details", 50);
    doc.moveDown(0.5);
    doc.font("Helvetica");
    // Split address into words and add them properly formatted
    const addressWords = invoice.company.address.split(/\s+/);
    let addressLine = "";
    const maxLineWidth = 300;
    
    addressWords.forEach((word) => {
      const testLine = addressLine ? `${addressLine} ${word}` : word;
      const testWidth = doc.widthOfString(testLine);
      
      if (testWidth > maxLineWidth && addressLine) {
        doc.text(addressLine, 50);
        doc.moveDown(0.3);
        addressLine = word;
      } else {
        addressLine = testLine;
      }
    });
    
    if (addressLine) {
      doc.text(addressLine, 50);
    }
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
