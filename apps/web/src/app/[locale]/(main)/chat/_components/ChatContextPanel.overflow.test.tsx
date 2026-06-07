import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ChatContextPanel } from './ChatContextPanel';
import type { ChatUser, Conversation } from './types';

// Radix ScrollArea (the panel's scroll container) calls ResizeObserver in a
// layout effect; jsdom has no layout engine and doesn't provide it. A no-op
// stub lets the REAL ScrollArea + the real header/participant DOM mount, which
// keeps the structural assertions below faithful (we are not mocking away the
// component under test, just satisfying a browser-only global).
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

/**
 * STRUCTURAL overflow-protection regression guard for ChatContextPanel.
 *
 * Why this file exists
 * --------------------
 * ChatContextPanel's header rows (DirectHeader / MatchGroupHeader) and its
 * participant rows have clipped / overflowed the right rail across a long bug
 * chain: #214 → #217 → #220 → #221 → #223. The fix each round was the same
 * `min-w-0` cascade on the flex header rows + `truncate` / `break-words` on
 * the text leaves — and it kept regressing because nothing guards it:
 *   - the `no-missing-min-w-in-grid-container` lint only covers CSS grid, not
 *     these flex rows;
 *   - the broad flex `min-w-0` lint was dropped;
 *   - the full-UI e2e overflow check isn't run in CI.
 *
 * jsdom has no layout engine, so it cannot measure real pixel overflow. This
 * is therefore a STRUCTURAL test: render the component with pathologically
 * long, unbreakable content (the #221 repro) and assert that the documented
 * overflow-protection classes are still present on the elements that need
 * them. If someone drops `min-w-0` / `truncate` / `break-words` again, these
 * assertions fail in the normal `vitest run` (jsdom) — no browser/Docker.
 *
 * Assertions are intentionally pinned to the STABLE protection mechanism
 * (`min-w-0` / `truncate` / `break-words`), never incidental styling.
 */

// Sibling-test convention: stub next-intl's translator to echo the key.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// ChatContextPanel imports `VerificationIcon` from the `@/components/features`
// barrel. That barrel re-exports submit-case/EssaySection, which does a bare
// `await import("pdfjs-dist")` (pdfjs is a runtime CDN dep, not installed as a
// package), so Vite's import-analysis fails to even transform the module graph
// in jsdom. We therefore stub ONLY this leaf badge with a recognizable span so
// the VERIFIED participant row still mounts realistically. VerificationIcon has
// none of the protection classes under test (min-w-0 / truncate / break-words),
// so stubbing it does not weaken any assertion below.
vi.mock('@/components/features', () => ({
  VerificationIcon: ({ verified }: { verified?: boolean }) =>
    verified ? <span data-testid="verification-icon" /> : null,
}));

// A long, unbreakable string is the #221 repro: no spaces means the browser
// cannot wrap it, so without min-w-0 + truncate/break-words it blows the
// column width and clips at the viewport edge.
const LONG_UNBROKEN =
  'ZhangWeiMingABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ZhangWeiMingABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LONG_TEAM_A = 'ScienceFairInnovatorsTeamAlphaUnbreakableNameThatIsWayTooLongForTheRail';
const LONG_TEAM_B = 'FullStackDevelopmentSquadTeamBetaUnbreakableNameThatIsWayTooLongForTheRail';
const LONG_CONTEXT = 'RegeneronScienceTalentSearchInnovationTrackUnbreakableContextLabel';

const noop = () => {};

function baseProps() {
  return {
    isLoading: false,
    isPinned: false,
    isArchived: false,
    isMuted: false,
    onPin: noop,
    onArchive: noop,
    onMute: noop,
    onReport: noop,
    onBlock: noop,
  };
}

function makeUser(overrides: Partial<ChatUser> & { id: string }): ChatUser {
  return {
    role: 'USER',
    ...overrides,
    profile: { ...overrides.profile },
  };
}

/**
 * Find the nearest `flex-1` content cell at/above `el` and return it.
 *
 * The documented protection is that the variable-width content column
 * (`min-w-0 flex-1`) inside each flex row is shrinkable. We deliberately
 * anchor on `flex-1` rather than walking all the way to the root `<aside>`
 * (which also carries `min-w-0`): asserting "some ancestor has min-w-0" would
 * be trivially satisfied by the root and would NOT catch a dropped min-w-0 on
 * the actual content cell — the exact #214→#223 regression.
 */
function nearestFlexCell(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    if (cur.classList.contains('flex-1')) return cur;
    cur = cur.parentElement;
  }
  return null;
}

describe('ChatContextPanel overflow protection (structural #214→#223 guard)', () => {
  it('Test A (DIRECT): peer title + participant name keep truncate in a min-w-0 flex cell', () => {
    const otherUser = makeUser({
      id: 'peer-1',
      // DIRECT title = getDisplayName(otherUser) → nickname. Make it unbreakable.
      profile: { nickname: LONG_UNBROKEN },
    });
    const conversation: Conversation = {
      id: 'conv-direct-1',
      kind: 'DIRECT',
      title: '',
      otherUser,
      participantCount: 1,
      participantPreview: [
        makeUser({
          id: 'member-1',
          // Participant displayName = getDisplayName(participant) → nickname.
          profile: { nickname: LONG_UNBROKEN },
        }),
      ],
      avatarSummary: [],
      unreadCount: 0,
      updatedAt: '2026-06-07T00:00:00.000Z',
    };

    const { container } = render(<ChatContextPanel {...baseProps()} conversation={conversation} />);

    // Panel root must clip + be shrinkable.
    const root = container.querySelector('aside');
    expect(root).not.toBeNull();
    expect(root).toHaveClass('min-w-0');
    expect(root).toHaveClass('overflow-hidden');

    // The long peer title and the long participant name both surface as text.
    // Every <p> that contains the unbreakable string must be `truncate`, AND
    // its enclosing `flex-1` content cell must be `min-w-0` (the cascade leaf —
    // without it the cell's default min-width:auto pushes the column past the
    // rail, the #214→#223 regression).
    const longTextNodes = Array.from(container.querySelectorAll('p')).filter((p) =>
      p.textContent?.includes(LONG_UNBROKEN)
    ) as HTMLElement[];

    // DirectHeader title + participant name = at least 2 occurrences.
    expect(longTextNodes.length).toBeGreaterThanOrEqual(2);

    for (const node of longTextNodes) {
      expect(node).toHaveClass('truncate');
      const cell = nearestFlexCell(node);
      expect(cell, 'long text should live inside a flex-1 content cell').not.toBeNull();
      expect(cell).toHaveClass('min-w-0');
    }

    // And the flex header row itself carries min-w-0 (the cascade root).
    const flexMinW0 = container.querySelectorAll('div.flex.min-w-0');
    expect(flexMinW0.length).toBeGreaterThanOrEqual(1);
  });

  it('Test B (MATCH_GROUP): structured team boxes keep break-words under a min-w-0 header', () => {
    // Canonical compound shape parseMatchTitle expects: "<context> · <A> × <B>".
    const compoundTitle = `${LONG_CONTEXT} · ${LONG_TEAM_A} × ${LONG_TEAM_B}`;
    const conversation: Conversation = {
      id: 'conv-group-1',
      kind: 'MATCH_GROUP',
      title: compoundTitle,
      createdBySystem: true,
      teamMatchId: 'team-match-1',
      otherUser: null,
      participantCount: 6,
      participantPreview: [
        makeUser({ id: 'gm-1', profile: { nickname: 'Alice' } }),
        makeUser({ id: 'gm-2', profile: { nickname: 'Bob' } }),
      ],
      avatarSummary: [],
      unreadCount: 0,
      updatedAt: '2026-06-07T00:00:00.000Z',
    };

    const { container } = render(<ChatContextPanel {...baseProps()} conversation={conversation} />);

    // The two structured team boxes render teamA / teamB verbatim.
    const teamABox = Array.from(container.querySelectorAll('div')).find(
      (d) => d.textContent === LONG_TEAM_A
    ) as HTMLElement | undefined;
    const teamBBox = Array.from(container.querySelectorAll('div')).find(
      (d) => d.textContent === LONG_TEAM_B
    ) as HTMLElement | undefined;

    expect(teamABox, 'structured teamA box should render').toBeTruthy();
    expect(teamBBox, 'structured teamB box should render').toBeTruthy();

    // Long team names must wrap, not clip — break-words is the protection.
    expect(teamABox).toHaveClass('break-words');
    expect(teamBBox).toHaveClass('break-words');

    // The MatchGroupHeader's flex row must carry min-w-0 (cascade root) and
    // its inner content column must be min-w-0 flex-1.
    const flexMinW0 = container.querySelectorAll('div.flex.min-w-0');
    expect(flexMinW0.length).toBeGreaterThanOrEqual(1);

    const innerCol = container.querySelector('div.min-w-0.flex-1');
    expect(innerCol).not.toBeNull();

    // The context label (long, unbreakable) must also be break-words.
    const contextNode = Array.from(container.querySelectorAll('p')).find(
      (p) => p.textContent === LONG_CONTEXT
    ) as HTMLElement | undefined;
    expect(contextNode, 'context label should render').toBeTruthy();
    expect(contextNode).toHaveClass('break-words');
  });
});
