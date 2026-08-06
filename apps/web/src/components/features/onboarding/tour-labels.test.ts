import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import zh from '@/messages/zh.json';

/**
 * A tour popover must call a section by the name the section actually shows.
 *
 * `dashboard.workbench.priorityQueue` was renamed to "To-do" / "待办" in #486,
 * but `tour.dashboard.priorityQueue` kept saying "Priority Queue" / "优先级
 * 队列". The tour was teaching a name the UI does not use — and the product
 * owner reported seeing "Priority Queue" months later, because that popover was
 * the only place the old name survived.
 *
 * Nothing connects these two strings, so nothing could notice they had drifted.
 * This is that connection.
 */
const PAIRS: Array<{ what: string; rendered: string[]; tour: string[] }> = [
  {
    what: 'the priority queue / to-do section',
    rendered: ['dashboard', 'workbench', 'priorityQueue'],
    tour: ['tour', 'dashboard', 'priorityQueue'],
  },
];

function at(messages: unknown, keyPath: string[]): unknown {
  return keyPath.reduce<unknown>(
    (node, key) => (node as Record<string, unknown> | undefined)?.[key],
    messages
  );
}

describe.each([
  ['en', en],
  ['zh', zh],
])('%s — tour copy names sections the way the UI does', (_locale, messages) => {
  it.each(PAIRS)('$what', ({ rendered, tour }) => {
    const uiLabel = at(messages, rendered);
    const tourLabel = at(messages, tour);

    // Both must exist: a missing key would make a naive equality check pass on
    // undefined === undefined, which is the vacuous-assertion trap this repo
    // has hit twice today.
    expect(typeof uiLabel).toBe('string');
    expect(typeof tourLabel).toBe('string');
    expect(tourLabel).toBe(uiLabel);
  });
});
