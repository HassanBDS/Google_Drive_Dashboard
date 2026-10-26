/**
 * Shared input validation utilities for API routes and cache path security.
 * Zero external dependencies.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Standard Google Drive ID regex.
 * IDs are URL-safe alphanumeric strings (typically 28-44 chars in Drive v3)
 * or the special 'root' alias.
 */
const DRIVE_ID_REGEX = /^(root|[a-zA-Z0-9_-]{10,200})$/;

/**
 * Validates a Google Drive folder or file ID.
 * Rejects path traversal attempts (../, /, \), control characters, and malformed IDs.
 */
export function validateDriveId(id: unknown): string {
  if (typeof id !== "string" || !id.trim()) {
    throw new ValidationError("Drive ID must be a non-empty string");
  }

  const trimmed = id.trim();
  if (!DRIVE_ID_REGEX.test(trimmed)) {
    throw new ValidationError("Invalid Google Drive ID format");
  }

  return trimmed;
}

/**
 * Validates and clamps an integer within [min, max].
 * If out of bounds, returns clamped value. If non-numeric and defaultValue provided, returns defaultValue.
 */
export function validatePositiveInt(
  value: unknown,
  min: number,
  max: number,
  defaultValue?: number
): number {
  if (value === undefined || value === null || value === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new ValidationError(`Value must be an integer between ${min} and ${max}`);
  }

  let num: number;
  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    num = parseInt(value, 10);
  } else {
    throw new ValidationError(`Expected a valid integer between ${min} and ${max}`);
  }

  if (isNaN(num) || !Number.isFinite(num)) {
    if (defaultValue !== undefined) return defaultValue;
    throw new ValidationError(`Expected a valid integer between ${min} and ${max}`);
  }

  if (num < min) return min;
  if (num > max) return max;
  return Math.floor(num);
}

/**
 * Validates an array of strings, ensuring length within bounds and validating each item as a Drive ID.
 */
export function validateStringArray(
  arr: unknown,
  maxLength: number,
  elementValidator: (val: unknown) => string = validateDriveId
): string[] {
  if (!Array.isArray(arr)) {
    throw new ValidationError("Expected an array of values");
  }

  if (arr.length > maxLength) {
    throw new ValidationError(`Array exceeds maximum allowed size of ${maxLength} items`);
  }

  return arr.map((item) => elementValidator(item));
}
