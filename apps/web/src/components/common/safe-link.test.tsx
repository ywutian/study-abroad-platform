import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

// Controllable pathname so we can simulate a soft nav that commits (changes) vs one that
// hangs (stays put). The i18n Link is mocked to a plain <a> so the click handler + the
// anchor's resolved href both behave like the real thing.
let mockPathname = '/chat';

vi.mock('@/lib/i18n/navigation', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ href, onClick, children, ...props }: any) => (
    <a
      href={typeof href === 'string' ? href : (href?.pathname ?? '#')}
      onClick={onClick}
      {...props}
    >
      {children}
    </a>
  ),
  usePathname: () => mockPathname,
}));

import { SafeLink } from './safe-link';

describe('SafeLink hard-navigation watchdog', () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPathname = '/chat';
    assign = vi.fn();
    // jsdom's location.assign is non-configurable, so spyOn fails — replace the
    // whole location object. Anchor .href still resolves against document.baseURI,
    // so currentTarget.href is unaffected.
    vi.stubGlobal('location', {
      assign,
      pathname: '/zh/chat',
      href: 'http://localhost:3000/zh/chat',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('hard-navigates when the soft nav never commits (pathname stays put)', () => {
    const { getByText } = render(<SafeLink href="/schools">Schools</SafeLink>);
    fireEvent.click(getByText('Schools'));

    // Route never moved off /chat → stuck.
    vi.advanceTimersByTime(3000);

    expect(assign).toHaveBeenCalledTimes(1);
    expect(String(assign.mock.calls[0][0])).toContain('/schools');
  });

  it('does NOT hard-navigate when the route commits (pathname changes)', () => {
    const { getByText, rerender } = render(<SafeLink href="/schools">Schools</SafeLink>);
    fireEvent.click(getByText('Schools'));

    // Successful soft nav: pathname commits → re-render updates the ref.
    mockPathname = '/schools';
    rerender(<SafeLink href="/schools">Schools</SafeLink>);

    vi.advanceTimersByTime(3000);
    expect(assign).not.toHaveBeenCalled();
  });

  it('ignores modified clicks (cmd/ctrl/shift — new tab etc.)', () => {
    const { getByText } = render(<SafeLink href="/schools">Schools</SafeLink>);
    fireEvent.click(getByText('Schools'), { metaKey: true });

    vi.advanceTimersByTime(3000);
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not arm the watchdog for the already-active route', () => {
    // Anchor resolves to the current location → nothing to recover.
    const here = window.location.pathname;
    const { getByText } = render(<SafeLink href={here}>Here</SafeLink>);
    fireEvent.click(getByText('Here'));

    vi.advanceTimersByTime(3000);
    expect(assign).not.toHaveBeenCalled();
  });

  it('still invokes a caller-supplied onClick', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <SafeLink href="/schools" onClick={onClick}>
        Schools
      </SafeLink>
    );
    fireEvent.click(getByText('Schools'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
