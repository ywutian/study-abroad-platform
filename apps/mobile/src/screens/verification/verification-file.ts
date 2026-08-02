export const MAX_VERIFICATION_FILE_SIZE = 7 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

const ACCEPTED_MIME = new Set(Object.values(MIME_BY_EXTENSION));

export type VerificationFileError = 'invalid_type' | 'missing_size' | 'too_large';

export function validateVerificationFile(input: {
  name: string;
  mimeType?: string | null;
  size?: number | null;
}): { mimeType: string } | { error: VerificationFileError } {
  const extension = input.name.split('.').pop()?.toLowerCase() ?? '';
  const inferredMime = MIME_BY_EXTENSION[extension];
  const mimeType =
    input.mimeType && ACCEPTED_MIME.has(input.mimeType) ? input.mimeType : inferredMime;
  if (!mimeType || !ACCEPTED_MIME.has(mimeType)) return { error: 'invalid_type' };
  if (input.size == null || !Number.isFinite(input.size)) return { error: 'missing_size' };
  if (input.size > MAX_VERIFICATION_FILE_SIZE) return { error: 'too_large' };
  return { mimeType };
}
