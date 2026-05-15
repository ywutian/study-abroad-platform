'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';
import { BreadcrumbJsonLd } from '@/components/seo';
import { ReportDialog } from '@/components/features/forum/ReportDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiClient as api } from '@/lib/api';
import { env } from '@/lib/env';
import { useAuthStore } from '@/stores/auth';
import type { Category, Community, Post } from './_components/forum-types';
import { CommunitySidebar } from './_components/community-sidebar';
import { CreatePostDialog } from './_components/create-post-dialog';
import { ForumRightRail } from './_components/forum-right-rail';
import { PostDetailDialog } from './_components/post-detail-dialog';
import { PostList } from './_components/post-list';

type ForumFeed = 'popular' | 'home' | 'latest';
type ForumSort = 'latest' | 'popular' | 'comments' | 'recommended';

export default function ForumPage() {
  const t = useTranslations('forum');
  const format = useFormatter();
  const { user } = useAuthStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [autoLoadPaused, setAutoLoadPaused] = useState(false);
  const [activeFeed, setActiveFeed] = useState<ForumFeed>('popular');
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [sortBy, setSortBy] = useState<ForumSort>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'POST' | 'COMMENT'; id: string } | null>(
    null
  );
  const [mobileCommunitiesOpen, setMobileCommunitiesOpen] = useState(false);
  const feedRequestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const selectedCommunityId = selectedCommunity?.id || null;

  const loadCommunities = useCallback(async () => {
    const [popular, mine] = await Promise.all([
      api.get<Community[]>('/forums/communities?scope=popular'),
      api.get<Community[]>('/forums/communities?scope=mine').catch(() => [] as Community[]),
    ]);

    const merged = new Map<string, Community>();
    [...(popular || []), ...(mine || [])].forEach((community) => {
      merged.set(community.id, { ...merged.get(community.id), ...community });
    });
    setCommunities(Array.from(merged.values()));
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [categoriesRes] = await Promise.all([
          api.get<Category[]>('/forums/categories'),
          loadCommunities(),
        ]);
        setCategories(categoriesRes || []);
      } catch {
        setCategories([
          { id: '1', name: 'Application Experience', nameZh: '申请经验', postCount: 0 },
          { id: '2', name: 'Essay Discussion', nameZh: '文书讨论', postCount: 0 },
        ]);
      }
    };

    fetchInitialData();
  }, [loadCommunities]);

  const fetchPosts = useCallback(
    async (nextPage = 1, append = false) => {
      if (append && loadingMoreRef.current) return;

      if (append) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        feedRequestIdRef.current += 1;
        setAutoLoadPaused(false);
        setLoading(true);
      }

      const requestId = feedRequestIdRef.current;
      try {
        const limit = 10;
        const params = new URLSearchParams({
          offset: String((nextPage - 1) * limit),
          limit: String(limit),
          sortBy,
          feed: activeFeed,
        });
        if (selectedCommunityId) params.set('communityId', selectedCommunityId);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());

        const res = await api.get<{ posts: Post[]; total: number; hasMore: boolean }>(
          `/forums/posts?${params.toString()}`
        );
        if (requestId !== feedRequestIdRef.current) return;

        const nextPosts = res?.posts || [];
        setPosts((current) => {
          if (!append) return nextPosts;
          const existingIds = new Set(current.map((post) => post.id));
          return [...current, ...nextPosts.filter((post) => !existingIds.has(post.id))];
        });
        setHasMore(Boolean(res?.hasMore));
        setPage(nextPage);
      } catch {
        if (requestId !== feedRequestIdRef.current) return;
        if (!append) {
          setPosts([]);
          setHasMore(false);
        } else {
          setAutoLoadPaused(true);
        }
      } finally {
        if (append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else if (requestId === feedRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [activeFeed, searchQuery, selectedCommunityId, sortBy]
  );

  useEffect(() => {
    fetchPosts(1, false);
  }, [fetchPosts]);

  const currentTitle = useMemo(() => {
    if (selectedCommunity) return `r/${selectedCommunity.name}`;
    return t(`feedLabel.${activeFeed}`);
  }, [activeFeed, selectedCommunity, t]);

  const handleSelectFeed = (feed: ForumFeed) => {
    setActiveFeed(feed);
    setSelectedCommunity(null);
    setSortBy(feed === 'popular' ? 'popular' : 'latest');
    setMobileCommunitiesOpen(false);
  };

  const handleSelectCommunity = (community: Community) => {
    setSelectedCommunity(community);
    setActiveFeed('latest');
    setSortBy('latest');
    setMobileCommunitiesOpen(false);
  };

  const handleToggleFollow = async (community: Community) => {
    if (!user) {
      toast.error(t('loginToFollow'));
      return;
    }

    const updated = community.isFollowing
      ? await api.delete<Community>(`/forums/communities/${community.id}/follow`)
      : await api.post<Community>(`/forums/communities/${community.id}/follow`);

    setCommunities((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
    if (selectedCommunity?.id === updated.id) setSelectedCommunity(updated);
  };

  const handleLike = async (postId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      toast.error(t('loginToReact'));
      return;
    }
    const res = await api.post<{ liked: boolean }>(`/forums/posts/${postId}/like`);
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: res.liked,
              likeCount: Math.max(0, post.likeCount + (res.liked ? 1 : -1)),
            }
          : post
      )
    );
  };

  const handleCommunityCreated = (community: Community) => {
    setCommunities((current) => {
      if (current.some((item) => item.id === community.id)) {
        return current.map((item) => (item.id === community.id ? community : item));
      }
      return [community, ...current];
    });
    setSelectedCommunity(community);
  };

  const handleCreateCommunity = () => {
    setSelectedCommunity(null);
    setShowCreateDialog(true);
  };

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setAutoLoadPaused(false);
    fetchPosts(page + 1, true);
  }, [fetchPosts, hasMore, loading, loadingMore, page]);

  const formatNumber = (num: number) => (num >= 1000 ? format.number(num, 'compact') : String(num));

  const sidebar = (
    <CommunitySidebar
      communities={communities}
      selectedCommunityId={selectedCommunityId}
      activeFeed={activeFeed}
      onSelectFeed={handleSelectFeed}
      onSelectCommunity={handleSelectCommunity}
      onCreateCommunity={handleCreateCommunity}
      onToggleFollow={handleToggleFollow}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-4 xl:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: env.NEXT_PUBLIC_APP_URL },
          { name: 'Forum', url: `${env.NEXT_PUBLIC_APP_URL}/forum` },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <div className="hidden lg:block">
          <div className="sticky top-16 max-h-[calc(100dvh-4.5rem)] overflow-y-auto pr-1">
            {sidebar}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <section className="rounded-lg border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  {t('title')}
                </div>
                <h1 className="truncate text-2xl font-semibold tracking-normal">{currentTitle}</h1>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {selectedCommunity?.description || t('redditForumDescription')}
                </p>
              </div>
              <div className="hidden shrink-0 text-right text-sm text-muted-foreground sm:block">
                {t('communityCount', { count: formatNumber(communities.length) })}
              </div>
            </div>
          </section>

          <PostList
            posts={posts}
            loading={loading}
            loadingMore={loadingMore}
            autoLoadMore={!autoLoadPaused}
            hasMore={hasMore}
            sortBy={sortBy}
            onSortChange={setSortBy}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearch={() => fetchPosts(1, false)}
            selectedCommunity={selectedCommunity}
            activeFeed={activeFeed}
            onClearCommunity={() => setSelectedCommunity(null)}
            onClearSearch={() => setSearchQuery('')}
            onLoadMore={handleLoadMore}
            onViewPost={setSelectedPost}
            onLike={handleLike}
            onReport={setReportTarget}
            onCreatePost={() => setShowCreateDialog(true)}
            onOpenCommunities={() => setMobileCommunitiesOpen(true)}
          />
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-16 max-h-[calc(100dvh-4.5rem)] overflow-y-auto">
            <ForumRightRail
              communities={communities}
              selectedCommunity={selectedCommunity}
              onCreatePost={() => setShowCreateDialog(true)}
              onCreateCommunity={handleCreateCommunity}
              onSelectCommunity={handleSelectCommunity}
              onToggleFollow={handleToggleFollow}
              formatNumber={formatNumber}
            />
          </div>
        </div>
      </div>

      <Sheet open={mobileCommunitiesOpen} onOpenChange={setMobileCommunitiesOpen}>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('communities')}</SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-6">{sidebar}</div>
        </SheetContent>
      </Sheet>

      <CreatePostDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        categories={categories}
        communities={communities}
        selectedCommunity={selectedCommunity}
        onCommunityCreated={handleCommunityCreated}
        onPostCreated={() => {
          loadCommunities();
          fetchPosts(1, false);
        }}
      />

      <PostDetailDialog
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onLike={handleLike}
        onReport={setReportTarget}
        user={user}
      />

      <ReportDialog
        open={reportTarget !== null}
        onOpenChange={(open) => !open && setReportTarget(null)}
        targetType={reportTarget?.type || 'POST'}
        targetId={reportTarget?.id || ''}
      />
    </div>
  );
}
