const DEFAULT_STRING_LIMIT = 40;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function uniqueSortedStrings(
  values: Iterable<string>,
  limit = DEFAULT_STRING_LIMIT,
): string[] {
  return Array.from(
    new Set(
      Array.from(values)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);
}

export function flattenJsonKeys(
  value: unknown,
  options?: {
    prefix?: string;
    depth?: number;
    maxKeys?: number;
  },
): string[] {
  const maxDepth = options?.depth ?? 2;
  const maxKeys = options?.maxKeys ?? DEFAULT_STRING_LIMIT;
  const keys: string[] = [];

  function visit(current: unknown, prefix: string, depth: number): void {
    if (keys.length >= maxKeys || depth > maxDepth) {
      return;
    }

    if (Array.isArray(current)) {
      const firstObject = current.find((item) => isPlainObject(item));
      if (firstObject) {
        visit(firstObject, `${prefix}[]`, depth);
      }
      return;
    }

    if (!isPlainObject(current)) {
      return;
    }

    for (const [key, nested] of Object.entries(current)) {
      if (keys.length >= maxKeys) {
        return;
      }
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      visit(nested, fullKey, depth + 1);
    }
  }

  visit(value, options?.prefix ?? '', 0);
  return uniqueSortedStrings(keys, maxKeys);
}

export function collectTokenStorageRisks(input: {
  localStorageKeys: string[];
  sessionStorageKeys: string[];
}): string[] {
  const riskyKeys = [
    ...input.localStorageKeys,
    ...input.sessionStorageKeys,
  ].filter((key) => /token|bearer|jwt|auth|session/i.test(key));

  if (riskyKeys.length === 0) {
    return [];
  }

  return riskyKeys.map(
    (key) =>
      `Script-readable storage key "${key}" may contain bearer or session material.`,
  );
}

export function detectChallengePoints(text: string): string[] {
  const haystack = text.toLowerCase();
  const matches = [
    ['captcha', /captcha/],
    ['rate-limit', /too many requests|rate limit|try again later/],
    [
      'human-verification',
      /verify you are human|human verification|are you a robot/,
    ],
    ['challenge', /security challenge|bot challenge|challenge required/],
  ].flatMap(([label, pattern]) => (pattern.test(haystack) ? [label] : []));

  return uniqueSortedStrings(matches, 10);
}

export function detectUiRoleGuards(text: string): string[] {
  const haystack = text.toLowerCase();
  const matches = [
    ['login-required', /sign in|log in|login required/],
    ['upgrade-required', /upgrade|premium|subscription required/],
    ['access-denied', /access denied|not authorized|permission denied/],
    ['institution-only', /for colleges|for schools|partner portal|institution/],
    ['admin-only', /admin|operator|internal only/],
  ].flatMap(([label, pattern]) => (pattern.test(haystack) ? [label] : []));

  return uniqueSortedStrings(matches, 10);
}

export function detectExportDownloadSurfaces(
  values: Iterable<string>,
): string[] {
  return uniqueSortedStrings(
    Array.from(values).filter((value) =>
      /download|export|csv|xlsx|xls|report/i.test(value),
    ),
    20,
  );
}
