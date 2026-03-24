/** Only allow http/https URLs as href targets (prevents javascript: XSS) */
export function isSafeUrl(url: string | undefined | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}
