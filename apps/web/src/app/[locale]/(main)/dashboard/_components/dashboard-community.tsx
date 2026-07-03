'use client';

import { ArrowRight, MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forumRoutes } from '@study-abroad/shared';

import { Skeleton } from '@/components/ui/skeleton';
import { useAuthGatedQuery } from '@/hooks/use-auth-gated-query';
import { apiClient } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

interface CommunityPost {
  id: string;
  title: string;
}

/**
 * Dashboard "community on-ramp" — a calm, NON-ranked belonging surface, not a
 * trending feed. The multi-agent design debate flagged that ranking forum
 * content by heat on the anxious applicant's home screen imports comparison
 * anxiety (Chinese admissions forums skew toward offer-flexing / "3.9 rejected"
 * posts). So: the most RECENT few titles only — no view/like/comment counts, no
 * leaderboards — and a door to /forum. Post detail is modal-based on the forum
 * page, so every row links to /forum rather than a per-post URL.
 */
export function DashboardCommunity() {
  const t = useTranslations('dashboard.community');

  // Auth-gated: /dashboard is a protected route, so a bare authed useQuery
  // 401-races before AuthInitializer restores the in-memory token (#145/#222).
  const { data, isLoading } = useAuthGatedQuery({
    queryKey: ['dashboard-community-recent'],
    queryFn: () =>
      apiClient.get<{ posts?: CommunityPost[] } | CommunityPost[]>(forumRoutes.posts(), {
        params: { sortBy: 'latest', limit: '5' },
      }),
    staleTime: 60_000,
  });

  const posts = (Array.isArray(data) ? data : (data?.posts ?? [])).slice(0, 5);

  return (
    <div className="rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-4 shadow-[var(--theme-card-shadow)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <MessagesSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
            {t('title')}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/forum"
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          {t('open')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 space-y-1">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-4/5" />
          </>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <Link
              key={post.id}
              href="/forum"
              className="flex items-center gap-2 rounded-[var(--theme-radius-card)] px-2 py-1.5 text-sm text-foreground/90 transition-colors hover:bg-muted"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
              <span className="line-clamp-1 min-w-0">{post.title}</span>
            </Link>
          ))
        ) : (
          <Link
            href="/forum"
            className="flex items-center justify-between gap-2 rounded-[var(--theme-radius-card)] border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground"
          >
            <span>{t('empty')}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        )}
      </div>
    </div>
  );
}
