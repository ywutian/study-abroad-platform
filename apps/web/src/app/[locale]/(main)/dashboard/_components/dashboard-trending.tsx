'use client';

import { ArrowRight, Heart, MessageCircle, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forumRoutes } from '@study-abroad/shared';

import { Skeleton } from '@/components/ui/skeleton';
import { useAuthGatedQuery } from '@/hooks/use-auth-gated-query';
import { apiClient } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

interface TrendingPost {
  id: string;
  title: string;
  likeCount?: number;
  commentCount?: number;
}

/**
 * Dashboard "Trending" — the hottest community discussions, ranked by
 * engagement (forum `sortBy=popular` → likeCount desc, pinned first).
 *
 * This deliberately overrides the earlier "belonging, not trending" default
 * (feedback 5f: the user explicitly asked for a trending board — "what's
 * hot / active discussions / good new posts to read"). To keep the anxious-
 * applicant concern in check we frame it around DISCUSSION activity (replies
 * + likes on active threads) rather than results/offers, and cap it at 5.
 *
 * Post detail is modal-based on the forum page, so every row links to /forum
 * rather than a per-post URL (same as the old community surface).
 */
export function DashboardTrending() {
  const t = useTranslations('dashboard.trending');

  // Auth-gated: /dashboard is protected, so a bare authed useQuery 401-races
  // before AuthInitializer restores the in-memory token (#145/#222). The forum
  // list endpoint itself is public, but the gate keeps the timing correct.
  const { data, isLoading } = useAuthGatedQuery({
    queryKey: ['dashboard-trending-posts'],
    queryFn: () =>
      apiClient.get<{ posts?: TrendingPost[] } | TrendingPost[]>(forumRoutes.posts(), {
        params: { sortBy: 'popular', limit: '5' },
      }),
    staleTime: 60_000,
  });

  const posts = (Array.isArray(data) ? data : (data?.posts ?? [])).slice(0, 5);

  return (
    <div className="rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-4 shadow-[var(--theme-card-shadow)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
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
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-4/5" />
          </>
        ) : posts.length > 0 ? (
          posts.map((post, index) => (
            <Link
              key={post.id}
              href="/forum"
              className="flex items-start gap-2 rounded-[var(--theme-radius-card)] px-2 py-1.5 text-sm text-foreground/90 transition-colors hover:bg-muted"
            >
              <span className="mt-0.5 w-4 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1">{post.title}</span>
                {((post.commentCount ?? 0) > 0 || (post.likeCount ?? 0) > 0) && (
                  <span className="mt-0.5 flex items-center gap-3 text-2xs text-muted-foreground">
                    {(post.commentCount ?? 0) > 0 && (
                      <span
                        className="inline-flex items-center gap-1"
                        aria-label={t('repliesLabel', { count: post.commentCount ?? 0 })}
                      >
                        <MessageCircle className="h-3 w-3" />
                        {post.commentCount}
                      </span>
                    )}
                    {(post.likeCount ?? 0) > 0 && (
                      <span
                        className="inline-flex items-center gap-1"
                        aria-label={t('likesLabel', { count: post.likeCount ?? 0 })}
                      >
                        <Heart className="h-3 w-3" />
                        {post.likeCount}
                      </span>
                    )}
                  </span>
                )}
              </span>
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
