/**
 * Extended Error that carries both the raw API message (for logging)
 * and a user-facing translated message (for toast).
 */
export class ApiError extends Error {
  /** User-facing translated message, safe to show in toast */
  displayMessage: string;
  /** HTTP status code */
  statusCode: number;

  constructor(rawMessage: string, displayMessage: string, statusCode: number) {
    super(rawMessage);
    this.name = 'ApiError';
    this.displayMessage = displayMessage;
    this.statusCode = statusCode;
  }
}
