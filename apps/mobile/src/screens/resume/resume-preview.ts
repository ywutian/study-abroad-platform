const MAX_PREVIEW_LINES = 4;

/** Produce a compact, read-only summary without assuming a section-specific schema. */
export function summarizeResumeSection(content: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const visit = (value: unknown, depth: number) => {
    if (lines.length >= MAX_PREVIEW_LINES || depth > 4 || value == null || value === '') return;
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text && !lines.includes(text)) lines.push(text);
      return;
    }
    if (typeof value === 'boolean') return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach((item) => visit(item, depth + 1));
    }
  };
  visit(content, 0);
  return lines;
}
