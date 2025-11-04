import {
  BoqItem,
  BoqItemSchema,
  BoqValidationIssue,
  BoqValidationResult,
  REQUIRED_HEADERS,
} from "../validation/boq.js";

/**
 * Parse CSV content into BOQ items
 */
function parseCSV(csvContent: string): BoqValidationResult {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return {
      items: [],
      issues: [{ row: 1, message: "CSV file is empty" }],
      counts: { totalRows: 0, ok: 0, errors: 1, duplicates: 0 },
    };
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.trim());

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
  const sapCol = headers.findIndex((h) => h.toLowerCase() === "sap #");
  const descCol = headers.findIndex(
    (h) => h.toLowerCase() === "short description"
  );
  const rateCol = headers.findIndex((h) => h.toLowerCase() === "rate");
  const unitCol = headers.findIndex((h) => h.toLowerCase() === "unit");
  const categoryCol = headers.findIndex(
    (h) => h.toLowerCase() === "category"
  );

  if (sapCol === -1 || descCol === -1 || rateCol === -1 || unitCol === -1) {
    return {
      items: [],
      issues,
      counts: {
        totalRows: lines.length - 1,
        ok: 0,
        errors: issues.length,
        duplicates: 0,
      },
    };
  }

  const items: BoqItem[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  // Process data rows (starting from row 2)
  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1; // 1-based row number
    const row = parseCSVLine(lines[i]);

    const sapNumber = (row[sapCol] || "").trim();
    const shortDescription = (row[descCol] || "").trim();
    const rate = normalizeDecimal(row[rateCol] || "");
    const unit = (row[unitCol] || "").trim();
    const category =
      categoryCol >= 0 ? (row[categoryCol] || "").trim() || undefined : undefined;

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
      continue;
    }

    if (seen.has(item.sapNumber)) {
      duplicates += 1;
      issues.push({
        row: rowNumber,
        column: "SAP #",
        message: `Duplicate SAP # '${item.sapNumber}'`,
      });
      continue;
    }
    seen.add(item.sapNumber);
    items.push(item);
  }

  if (lines.length === 1) {
    issues.push({ row: 1, message: "CSV file has no data rows" });
  }

  return {
    items,
    issues,
    counts: {
      totalRows: lines.length - 1,
      ok: items.length,
      errors: issues.length,
      duplicates,
    },
  };
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);
  return result;
}

/**
 * Normalize decimal values (replace comma with dot)
 */
function normalizeDecimal(input: unknown): string {
  const str = String(input ?? "").trim();
  return str.replace(",", ".");
}

/**
 * Validate BOQ CSV file
 */
export async function validateBoqCSV(
  buffer: Buffer | Uint8Array | ArrayBuffer
): Promise<BoqValidationResult> {
  let csvContent: string;

  try {
    // Convert buffer to string
    if (Buffer.isBuffer(buffer)) {
      csvContent = buffer.toString("utf-8");
    } else if (buffer instanceof ArrayBuffer) {
      csvContent = Buffer.from(buffer).toString("utf-8");
    } else {
      csvContent = Buffer.from(buffer).toString("utf-8");
    }
  } catch (error) {
    return {
      items: [],
      issues: [
        {
          row: 1,
          message: `Failed to parse CSV file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ],
      counts: { totalRows: 0, ok: 0, errors: 1, duplicates: 0 },
    };
  }

  return parseCSV(csvContent);
}

