import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Every `[data-tour="…"]` a tour step points at must exist in the markup.
 *
 * driver.js does not throw on a selector that matches nothing — the step is
 * skipped or highlights empty space, silently. So a component moving, being
 * renamed, or losing the attribute breaks onboarding with no error anywhere:
 * exactly the failure shape this repo keeps finding.
 *
 * Prompted by moving DashboardQuickAsk into the sidebar (feedback D2). That
 * move was safe because the attribute travelled with the element — but nothing
 * would have told me if it hadn't.
 *
 * Source-level on purpose: the alternative is booting every tour-hosting page
 * in jsdom, and the thing that regresses here is an attribute existing at all,
 * which a grep sees perfectly well.
 */
const SRC = path.resolve(__dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) out.push(full);
  }
  return out;
}

describe('tour anchors', () => {
  const tourSrc = fs.readFileSync(path.join(__dirname, 'tour-provider.tsx'), 'utf8');
  const referenced = [
    ...new Set([...tourSrc.matchAll(/\[data-tour="([^"]+)"\]/g)].map((m) => m[1])),
  ];

  const rendered = new Set<string>();
  for (const file of walk(SRC)) {
    // Skip tour-provider itself. Its own step definitions contain the literal
    // `[data-tour="…"]`, so counting them as "rendered" makes the file its own
    // proof and every assertion below vacuously true — which is exactly what
    // the first version of this test did: renaming the anchor in page.tsx left
    // all 13 cases green.
    if (file.endsWith('tour-provider.tsx')) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const m of content.matchAll(/data-tour="([^"]+)"/g)) rendered.add(m[1]);

    // Nav links build the attribute from their href — `nav-${item.href.slice(1)}`
    // — so a literal scan cannot see them. Expand the same derivation the
    // component uses, from the href list it actually renders. A regex-only
    // check would report these as missing, which is a false alarm strong
    // enough to get the whole test deleted.
    if (/data-tour=\{`nav-\$\{item\.href/.test(content)) {
      for (const m of content.matchAll(/href: '\/([a-z-]+)'/g)) rendered.add(`nav-${m[1]}`);
    }
  }

  it('references at least one anchor (the regex still matches the source)', () => {
    // Guards the test itself: if tour-provider is restructured so this pattern
    // stops matching, an empty list would make every assertion below vacuous.
    expect(referenced.length).toBeGreaterThan(5);
  });

  it.each(referenced)('anchor %s is rendered somewhere', (anchor) => {
    expect(rendered.has(anchor)).toBe(true);
  });
});
