import type { CsvParseResult, ImportUser } from "../types/safeq";
import { validateImportUser } from "../types/safeq";

/**
 * Detect the delimiter used in a CSV file
 */
function detectDelimiter(content: string): string {
  const delimiters = [";", ",", "\t", "|"];
  const firstLine = content.split("\n")[0];

  let maxCount = 0;
  let detectedDelimiter = ",";

  for (const delimiter of delimiters) {
    const count = firstLine.split(delimiter).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  }

  return detectedDelimiter;
}

/**
 * Parse CSV content into ImportUser array
 */
export function parseCsv(content: string): CsvParseResult {
  const result: CsvParseResult = {
    users: [],
    errors: [],
    warnings: [],
  };

  try {
    // Remove BOM if present
    const cleanContent = content.replace(/^\uFEFF/, "");

    if (!cleanContent.trim()) {
      result.errors.push("CSV file is empty");
      return result;
    }

    // Detect delimiter
    const delimiter = detectDelimiter(cleanContent);
    result.warnings.push(`Detected delimiter: "${delimiter}"`);

    // Split into lines
    const lines = cleanContent.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length === 0) {
      result.errors.push("No data found in CSV file");
      return result;
    }

    // Parse header
    const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
    result.warnings.push(`Found columns: ${headers.join(", ")}`);

    // Map column names to expected field names
    const columnMap: Record<string, string> = {
      upn: "userName",
      username: "userName",
      user: "userName",
      fullname: "fullName",
      name: "fullName",
      emailaddress: "email",
      email: "email",
      cardid: "cardId",
      card: "cardId",
      shortid: "shortId",
      short: "shortId",
      pin: "shortId",
      otp: "otp",
      pid: "providerId",
      providerid: "providerId",
      provider: "providerId",
    };

    // Find required columns
    const userNameIndex = headers.findIndex((h) => columnMap[h] === "userName");
    if (userNameIndex === -1) {
      result.errors.push("Required column 'UPN' or 'Username' not found in CSV");
      return result;
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(delimiter).map((v) => v.trim());

      // Build user object
      const user: Partial<ImportUser> = {
        id: crypto.randomUUID(),
        userName: "",
        fullName: "",
        email: "",
        cardId: "",
        shortId: "",
        otp: "",
        providerId: undefined,
        errors: [],
        isValid: true,
      };

      // Map columns to user fields
      headers.forEach((header, index) => {
        const fieldName = columnMap[header];
        const value = values[index] || "";

        if (fieldName === "providerId") {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed)) {
            user.providerId = parsed;
          }
        } else if (fieldName && fieldName in user) {
          (user as any)[fieldName] = value;
        }
      });

      // Validate user
      const errors = validateImportUser(user);
      user.errors = errors;
      user.isValid = errors.length === 0;

      if (errors.length > 0) {
        result.warnings.push(`Row ${i}: ${errors.join(", ")}`);
      }

      result.users.push(user as ImportUser);
    }

    if (result.users.length === 0) {
      result.errors.push("No valid user records found in CSV");
    } else {
      result.warnings.push(`Parsed ${result.users.length} user(s)`);
    }
  } catch (error) {
    result.errors.push(`Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  return result;
}

/**
 * Read a file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
