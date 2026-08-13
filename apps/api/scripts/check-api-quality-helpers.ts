/** True when the current line or its contiguous leading comment block carries the tag. */
export function hasIgnoreTag(
  lines: string[],
  idx: number,
  tag: string,
): boolean {
  if ((lines[idx] ?? '').includes(tag)) return true;

  for (let lineIndex = idx - 1; lineIndex >= 0; lineIndex--) {
    const line = (lines[lineIndex] ?? '').trim();
    const isComment =
      line.startsWith('//') || line.startsWith('*') || line.startsWith('/*');
    if (!isComment) break;
    if (line.includes(tag)) return true;
  }

  return false;
}

/** Collect text inside a call's outer parentheses, tracking depth across at most 40 lines. */
export function gatherParenText(
  lines: string[],
  startIdx: number,
  openCol: number,
): string {
  let depth = 0;
  let text = '';
  const end = Math.min(lines.length, startIdx + 40);

  for (let lineIndex = startIdx; lineIndex < end; lineIndex++) {
    const segment =
      lineIndex === startIdx
        ? lines[lineIndex].slice(openCol)
        : lines[lineIndex];
    for (const character of segment) {
      if (character === '(') {
        depth++;
        if (depth === 1) continue;
      } else if (character === ')') {
        depth--;
        if (depth === 0) return text;
      }
      if (depth >= 1) text += character;
    }
    if (depth >= 1) text += '\n';
  }

  return text;
}
