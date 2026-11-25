import { z } from "zod";
import type { LinkRecord } from "@/db/schema";
import { validateDestinationUrl } from "@/lib/security/url-validator";
import { validateCustomSlug } from "@/lib/security/slug-validator";

const FORMULA_TRIGGER_REGEX = /^[=+\-@\t\r]/;

/**
 * Neutralizes CSV formula injection (DDE / Excel / Sheets formula execution)
 * by prefixing cells beginning with =, +, -, @, tab, or CR with a single quote.
 */
export function sanitizeCsvFormula(value: string): string {
  if (FORMULA_TRIGGER_REGEX.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function escapeCsvCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  const str = sanitizeCsvFormula(String(raw));
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportLinksToCsv(records: LinkRecord[]): string {
  const headers = [
    "slug",
    "destination_url",
    "redirect_code",
    "status",
    "clicks",
    "max_clicks",
    "expires_at",
    "note",
    "created_at",
  ];
  const lines = [headers.join(",")];

  for (const r of records) {
    lines.push(
      [
        escapeCsvCell(r.slug),
        escapeCsvCell(r.destinationUrl),
        escapeCsvCell(r.redirectCode),
        escapeCsvCell(r.status),
        escapeCsvCell(r.clicks),
        escapeCsvCell(r.maxClicks),
        escapeCsvCell(r.expiresAt ? new Date(r.expiresAt).toISOString() : ""),
        escapeCsvCell(r.note),
        escapeCsvCell(new Date(r.createdAt).toISOString()),
      ].join(",")
    );
  }

  return lines.join("\n");
}

export function exportLinksToJson(records: LinkRecord[]): string {
  const clean = records.map((r) => ({
    slug: r.slug,
    destinationUrl: r.destinationUrl,
    redirectCode: r.redirectCode,
    status: r.status,
    clicks: r.clicks,
    maxClicks: r.maxClicks,
    expiresAt: r.expiresAt,
    note: r.note,
    createdAt: r.createdAt,
  }));
  return JSON.stringify(clean, null, 2);
}

const importRowSchema = z.object({
  slug: z.string().min(2).max(64),
  destinationUrl: z.string().min(1).max(4096),
  redirectCode: z.coerce
    .number()
    .pipe(z.union([z.literal(301), z.literal(302), z.literal(307)]))
    .optional()
    .default(302),
  status: z.enum(["active", "disabled"]).optional().default("active"),
  maxClicks: z
    .union([z.coerce.number().int().positive(), z.null(), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  expiresAt: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      const ts = Date.parse(v);
      return Number.isFinite(ts) ? ts : null;
    }),
  note: z.string().max(500).nullable().optional(),
});

export type ValidatedImportRow = z.infer<typeof importRowSchema>;

function parseCsvLines(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(current);
      current = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      i++;
    } else if (ch === "\n" || ch === "\r") {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function unescapeSanitizedFormulaPrefix(val: string): string {
  if (val.startsWith("'") && FORMULA_TRIGGER_REGEX.test(val.slice(1))) {
    return val.slice(1);
  }
  return val;
}

export function parseLinksImport(
  format: "json" | "csv",
  content: string,
  options: { requestHost?: string | null } = {}
): { rows: ValidatedImportRow[]; errors: string[] } {
  const rawObjects: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  if (format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { rows: [], errors: ["Invalid JSON payload."] };
    }
    if (!Array.isArray(parsed)) {
      return { rows: [], errors: ["JSON import must be an array of link objects."] };
    }
    for (const item of parsed) {
      if (item && typeof item === "object") {
        rawObjects.push(item as Record<string, unknown>);
      }
    }
  } else {
    const matrix = parseCsvLines(content);
    if (matrix.length < 2) {
      return {
        rows: [],
        errors: ["CSV import must include a header row and at least one data row."],
      };
    }
    const headers = matrix[0].map((h) => h.trim().toLowerCase());
    for (let i = 1; i < matrix.length; i++) {
      const cells = matrix[i];
      const obj: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        const rawVal = unescapeSanitizedFormulaPrefix(cells[idx] ?? "");
        if (h === "destination_url" || h === "destinationurl") {
          obj.destinationUrl = rawVal;
        } else if (h === "redirect_code" || h === "redirectcode") {
          obj.redirectCode = rawVal || 302;
        } else if (h === "max_clicks" || h === "maxclicks") {
          obj.maxClicks = rawVal || null;
        } else if (h === "expires_at" || h === "expiresat") {
          obj.expiresAt = rawVal || null;
        } else if (h === "slug") {
          obj.slug = rawVal;
        } else if (h === "status") {
          obj.status = rawVal === "" ? "active" : rawVal;
        } else if (h === "note") {
          obj.note = rawVal || null;
        }
      });
      rawObjects.push(obj);
    }
  }

  const validRows: ValidatedImportRow[] = [];
  rawObjects.forEach((raw, idx) => {
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`Row ${idx + 1}: invalid schema.`);
      return;
    }

    const slugCheck = validateCustomSlug(parsed.data.slug);
    if (!slugCheck.valid || !slugCheck.slug) {
      errors.push(`Row ${idx + 1}: ${slugCheck.error}`);
      return;
    }

    const urlCheck = validateDestinationUrl(parsed.data.destinationUrl, {
      requestHost: options.requestHost,
    });
    if (!urlCheck.valid || !urlCheck.url) {
      errors.push(`Row ${idx + 1}: ${urlCheck.error}`);
      return;
    }

    if (
      parsed.data.redirectCode === 301 &&
      (parsed.data.expiresAt !== null || parsed.data.maxClicks !== null)
    ) {
      parsed.data.redirectCode = 302;
    }

    validRows.push({
      ...parsed.data,
      slug: slugCheck.slug,
      destinationUrl: urlCheck.url,
    });
  });

  return { rows: validRows, errors };
}
