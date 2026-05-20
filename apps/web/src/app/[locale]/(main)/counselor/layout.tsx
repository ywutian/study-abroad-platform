import type { Metadata } from 'next';

/**
 * Counselor route layout — B2B暗线 (PR 2 · §D).
 *
 * Metadata MUST mark the whole subtree `noindex, nofollow`. This is the
 * editorial promise that the workbench surface stays invisible to public
 * search and link-discovery. The backend endpoints behind this UI are
 * separately gated by `@Roles(COUNSELOR, ADMIN, SUPER_ADMIN)` — this is
 * the SEO-layer half of the same lock.
 */
export const metadata: Metadata = {
  title: 'Counselor Workbench',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function CounselorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
