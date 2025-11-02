import ExcelJS from "exceljs";
import { Buffer } from "buffer";
import {
  BoqItem,
  BoqItemSchema,
  BoqValidationIssue,
  BoqValidationResult,
  REQUIRED_HEADERS,
} from "../validation/boq.js";

function normalizeDecimal(input: unknown): string {
  const str = String(input ?? "").trim();
  return str.replace(",", ".");
}

function getCellValue(cell: ExcelJS.Cell | null | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object" && "text" in cell.value) {
    return String((cell.value as any).text);
  }
  return String(cell.value);
}

/**
 * Converts various buffer types to a Node.js Buffer compatible with exceljs
 * This ensures type compatibility by creating a fresh Buffer instance
 * and explicitly typing it to satisfy exceljs's type requirements
 */
function toNodeBuffer(
  input: Buffer | Uint8Array | ArrayBuffer
): Buffer & { [Symbol.toStringTag]: "Buffer" } {
  let uint8: Uint8Array;
  if (Buffer.isBuffer(input)) {
    uint8 = new Uint8Array(input);
  } else if (input instanceof ArrayBuffer) {
    uint8 = new Uint8Array(input);
  } else {
    uint8 = input;
  }
  // Create new Buffer from Uint8Array to ensure clean type
  const buf = Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  // Type assertion to match exceljs's expected Buffer type
  return buf as Buffer & { [Symbol.toStringTag]: "Buffer" };
}

export async function validateBoqWorkbook(
  buffer: Buffer | Uint8Array | ArrayBuffer
): Promise<BoqValidationResult> {
  const workbook = new ExcelJS.Workbook();

  // Convert to clean Node.js Buffer
  const nodeBuffer = toNodeBuffer(buffer);

  try {
    await workbook.xlsx.load(nodeBuffer);
  } catch (error) {
    return {
      items: [],
      issues: [
        {
          row: 1,
          message: `Failed to parse Excel file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ],
      counts: { totalRows: 0, ok: 0, errors: 1, duplicates: 0 },
    };
  }

  if (workbook.worksheets.length === 0) {
    return {
      items: [],
      issues: [{ row: 1, message: "Workbook has no sheets" }],
      counts: { totalRows: 0, ok: 0, errors: 1, duplicates: 0 },
    };
  }

  const sheetName =
    workbook.worksheets.find((ws) => ws.name.toLowerCase() === "boq")?.name ??
    workbook.worksheets[0].name;
  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    return {
      items: [],
      issues: [{ row: 1, message: "Worksheet not found" }],
      counts: { totalRows: 0, ok: 0, errors: 1, duplicates: 0 },
    };
  }

  // Read header row (row 1)
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = getCellValue(cell).trim();
  });

  // Validate headers (case-insensitive)
  const missing = REQUIRED_HEADERS.filter(
    (h) => !headers.some((x) => x.toLowerCase() === h.toLowerCase())
  );
  const issues: BoqValidationIssue[] = [];
  if (missing.length) {
    issues.push({
      row: 1,
      message: `Missing required columns: ${missing.join(", ")}`,
    });
  }

  // Find column indices (case-insensitive)
  const sapCol = headers.findIndex((h) => h.toLowerCase() === "sap #") + 1;
  const descCol =
    headers.findIndex((h) => h.toLowerCase() === "short description") + 1;
  const rateCol = headers.findIndex((h) => h.toLowerCase() === "rate") + 1;
  const unitCol = headers.findIndex((h) => h.toLowerCase() === "unit") + 1;
  const categoryCol =
    headers.findIndex((h) => h.toLowerCase() === "category") + 1;

  if (!sapCol || !descCol || !rateCol || !unitCol) {
    return {
      items: [],
      issues,
      counts: {
        totalRows: worksheet.rowCount - 1,
        ok: 0,
        errors: issues.length,
        duplicates: 0,
      },
    };
  }

  const items: BoqItem[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let processedRows = 0;

  // Process data rows (starting from row 2)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row

    processedRows++;
    const sapNumber = getCellValue(row.getCell(sapCol)).trim();
    const shortDescription = getCellValue(row.getCell(descCol)).trim();
    const rate = normalizeDecimal(row.getCell(rateCol).value);
    const unit = getCellValue(row.getCell(unitCol)).trim();
    const category =
      categoryCol > 0
        ? getCellValue(row.getCell(categoryCol)).trim() || undefined
        : undefined;

    const item: BoqItem = {
      sapNumber,
      shortDescription,
      rate,
      unit,
      category,
    };

    const parsed = BoqItemSchema.safeParse(item);
    if (!parsed.success) {
      parsed.error.issues.forEach((e) => {
        issues.push({
          row: rowNumber,
          column: e.path.join("."),
          message: e.message,
        });
      });
      return;
    }

    if (seen.has(item.sapNumber)) {
      duplicates += 1;
      issues.push({
        row: rowNumber,
        column: "SAP #",
        message: `Duplicate SAP # '${item.sapNumber}'`,
      });
      return;
    }
    seen.add(item.sapNumber);
    items.push(item);
  });

  if (processedRows === 0) {
    issues.push({ row: 1, message: "Sheet is empty (no data rows found)" });
  }

  return {
    items,
    issues,
    counts: {
      totalRows: processedRows,
      ok: items.length,
      errors: issues.length,
      duplicates,
    },
  };
}
