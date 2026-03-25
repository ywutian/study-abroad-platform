/**
 * Extended Error that carries both the raw API message (for logging)
 * and a user-facing translated message (for toast).
 */
export class ApiError extends Error {
  /** User-facing translated message, safe to show in toast */
  displayMessage: string;
  /** HTTP status code */
  statusCode: number;
  /** Structured error code from backend (e.g. SCHOOL_LIST_DUPLICATE) */
  code?: string;
  /** Additional error details from backend */
  details?: Record<string, unknown>;

  constructor(
    rawMessage: string,
    displayMessage: string,
    statusCode: number,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(rawMessage);
    this.name = 'ApiError';
    this.displayMessage = displayMessage;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
