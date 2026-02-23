/**
 * Structured error codes for the prediction module.
 * Used in HTTP exception responses for programmatic error handling.
 */
export enum PredictionErrorCode {
  PROFILE_NOT_FOUND = 'PREDICTION_PROFILE_NOT_FOUND',
  IN_PROGRESS = 'PREDICTION_IN_PROGRESS',
  AI_TIMEOUT = 'PREDICTION_AI_TIMEOUT',
  VALIDATION_ERROR = 'PREDICTION_VALIDATION_ERROR',
}

/** AI call timeout in milliseconds */
export const AI_PREDICTION_TIMEOUT_MS = 15_000;

/** Prediction idempotency lock TTL in seconds */
export const PREDICTION_LOCK_TTL = 120;
