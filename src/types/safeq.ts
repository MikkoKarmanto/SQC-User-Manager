/**
 * SafeQ Cloud user object as returned by the API.
 * Based on SafeQ Cloud API v1 documentation.
 */
export interface SafeQUser {
  id: number;
  userName: string;
  email?: string;
  fullName?: string;
  shortId?: string;
  otp?: string;
  department?: string;
  accountId?: number;
  providerId?: number;
  groupIds?: number[];
  cards?: string[];
  token?: string | null;
  isExpired?: boolean | null;
  createdDate?: string;
  [key: string]: unknown; // Allow additional fields
}

/**
 * SafeQ Cloud authentication provider
 */
export interface SafeQAuthProvider {
  id: number;
  name: string;
  type?: string;
  accountId?: number;
  [key: string]: unknown; // Allow additional fields
}

/**
 * Response from the /api/v1/users/all endpoint
 */
export interface SafeQUsersResponse {
  items?: SafeQUser[];
  recordsOnPage?: number;
  nextPageToken?: string | null;
  [key: string]: unknown; // Allow additional response fields
}

/**
 * Type guard to check if a value is a SafeQUsersResponse
 */
export function isSafeQUsersResponse(value: unknown): value is SafeQUsersResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Must have items array or at least be an object
  if ("items" in obj) {
    return Array.isArray(obj.items);
  }

  return true;
}

/**
 * Extract users array from API response
 */
export function extractUsers(response: unknown): SafeQUser[] {
  if (!isSafeQUsersResponse(response)) {
    return [];
  }

  return response.items || [];
}

/**
 * User data imported from CSV for bulk creation
 */
export interface ImportUser {
  id: string; // Local unique ID for tracking in UI
  userName: string;
  fullName?: string;
  email?: string;
  cardId?: string;
  shortId?: string;
  otp?: string;
  providerId?: number;
  errors: string[]; // Validation errors
  isValid: boolean;
}

/**
 * Result of CSV parsing
 */
export interface CsvParseResult {
  users: ImportUser[];
  errors: string[];
  warnings: string[];
}

/**
 * Validate an imported user
 */
export function validateImportUser(user: Partial<ImportUser>): string[] {
  const errors: string[] = [];

  if (!user.userName || user.userName.trim() === "") {
    errors.push("Username is required");
  }

  if (user.providerId !== undefined && user.providerId < 0) {
    errors.push("Provider ID must be a positive number");
  }

  return errors;
}
