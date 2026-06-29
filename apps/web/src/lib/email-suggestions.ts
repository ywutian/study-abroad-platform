// Common providers (international + China) for signup email autocomplete and
// typo correction. Pure + framework-free so it's unit-testable in isolation.
export const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'yahoo.com',
  'qq.com',
  '163.com',
  '126.com',
  'foxmail.com',
];

/** Levenshtein edit distance (two-row; inputs are short email domains). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * Suggest up to 4 completed / typo-corrected addresses for a partially-typed
 * email. Returns [] until an `@` with a non-empty local part is present.
 *
 * - `foo@`           → top providers (`foo@gmail.com`, …)
 * - `foo@g`          → prefix completions (`foo@gmail.com`)
 * - `foo@gmial.com`  → typo correction (`foo@gmail.com`, edit distance ≤ 2)
 */
export function suggestEmailDomains(value: string): string[] {
  const at = value.indexOf('@');
  if (at <= 0) return [];
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();
  if (!domain) return COMMON_EMAIL_DOMAINS.slice(0, 4).map((d) => `${local}@${d}`);

  const prefix = COMMON_EMAIL_DOMAINS.filter((d) => d.startsWith(domain) && d !== domain);
  // Only offer typo corrections when nothing prefixes and it isn't already valid.
  const typo =
    prefix.length === 0 && !COMMON_EMAIL_DOMAINS.includes(domain)
      ? COMMON_EMAIL_DOMAINS.filter((d) => {
          const e = editDistance(domain, d);
          return e > 0 && e <= 2;
        })
      : [];

  return [...prefix, ...typo].slice(0, 4).map((d) => `${local}@${d}`);
}
