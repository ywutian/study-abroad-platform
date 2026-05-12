export function schoolMediaJsonReplacer(key: string, value: unknown): unknown {
  if (key === 'buffer') {
    if (
      value &&
      typeof value === 'object' &&
      'data' in value &&
      Array.isArray((value as { data?: unknown }).data)
    ) {
      return `[buffer omitted: ${(value as { data: unknown[] }).data.length} bytes]`;
    }
    return '[buffer omitted]';
  }

  if (
    value &&
    typeof value === 'object' &&
    'type' in value &&
    (value as { type?: unknown }).type === 'Buffer' &&
    'data' in value &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return `[buffer omitted: ${(value as { data: unknown[] }).data.length} bytes]`;
  }

  return value;
}

export function stringifySchoolMediaResult(value: unknown): string {
  return JSON.stringify(value, schoolMediaJsonReplacer, 2);
}
