import type { CSSProperties } from 'react';

import { Header, PageTransitionWrapper, MobileTabBar } from '@/components/layout';
import { FloatingChat } from '@/components/features/agent-chat';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';

/**
 * `--app-header-h`: total vertical offset that page content needs to
 * subtract from `100dvh` when it wants to fill the viewport (e.g.
 * the chat workbench).
 *
 * This is NOT the bare <Header> height (h-14 = 3.5rem). It's the
 * header (3.5rem) PLUS the <main> top padding (sm:py-8 = 2rem) PLUS
 * a small breathing-room buffer (1rem). The number used to be a
 * magic `6.5rem` literal embedded inside `/chat/page.tsx`; pulling
 * it onto the layout wrapper as a CSS variable means a single edit
 * here re-flows every workbench-style page.
 */
const APP_SHELL_VARS: CSSProperties & Record<'--app-header-h', string> = {
  '--app-header-h': '6.5rem',
};

const isDev = process.env.NODE_ENV !== 'production';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="app-shell relative isolate min-h-dvh flex flex-col bg-background text-foreground"
      style={APP_SHELL_VARS}
    >
      <div className="app-shell-bg pointer-events-none fixed inset-0 -z-10" />
      <Header />
      <PageTransitionWrapper className="flex-1">
        <main
          className={cn(
            'py-6 sm:py-8 pb-20 md:pb-8',
            // 2026-05 PR 3: `overflow-x-clip` is the production safety
            // net that hides horizontal overflow from users. In
            // development we drop it so OverflowDetector can flag the
            // real bug instead of silently masking it — this is how
            // PR #214/#215 missed mid-level grid descendants the
            // first time around.
            !isDev && 'overflow-x-clip'
          )}
        >
          <ErrorBoundary level="page">{children}</ErrorBoundary>
        </main>
      </PageTransitionWrapper>
      <FloatingChat />
      <MobileTabBar />
    </div>
  );
}
