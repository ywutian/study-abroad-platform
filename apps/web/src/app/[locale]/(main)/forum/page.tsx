'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { BreadcrumbJsonLd } from '@/components/seo';
import { env } from '@/lib/env';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  FileText,
  Users,
  TrendingUp,
  PenLine,
  Search,
  Flame,
  HelpCircle,
  Bot,
} from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/layout';
import { apiClient as api } from '@/lib/api';
import { ReportDialog } from '@/components/features/forum/ReportDialog';
import { useAuthStore } from '@/stores/auth';
import { AiAssistantPanel, type ContextAction } from '@/components/features/agent-chat';

import type { Category, Post } from './_components/forum-types';
import { CategorySidebar } from './_components/category-sidebar';
import { CreatePostDialog } from './_components/create-post-dialog';
import { PostDetailDialog } from './_components/post-detail-dialog';
import { PostList } from './_components/post-list';

export default function ForumPage() {
  const t = useTranslations('forum');
  const locale = useLocale();
  const format = useFormatter();
  const { user } = useAuthStore();
  const isVerified =
    user?.role === 'VERIFIED' ||
    user?.role === 'OPERATOR' ||
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN';

  // States
  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'comments' | 'recommended'>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTeamOnly, setShowTeamOnly] = useState(false);
  const [postTag] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'POST' | 'COMMENT'; id: string } | null>(
    null
  );
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isTeamPostCreate, setIsTeamPostCreate] = useState(false);

  // Stats
  const [forumStats, setForumStats] = useState({
    postCount: 0,
    userCount: 0,
    teamingCount: 0,
    activeToday: 0,
  });

  const suggestedTags = useMemo(
    () => ['MIT', 'Stanford', 'Harvard', 'CS', 'GPA', 'GRE', 'TOEFL', 'SAT', 'ACT'],
    []
  );

  // Fetch categories and stats
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, statsRes] = await Promise.all([
          api.get<Category[]>('/forums/categories'),
          api.get<{
            postCount: number;
            userCount: number;
            teamingCount: number;
            activeToday: number;
          }>('/forums/stats'),
        ]);
        if (categoriesRes && categoriesRes.length > 0) setCategories(categoriesRes);
        if (statsRes) setForumStats(statsRes);
      } catch {
        setCategories([
          { id: '1', name: 'Application Experience', nameZh: '申请经验', postCount: 0 },
          { id: '2', name: 'Essay Discussion', nameZh: '文书讨论', postCount: 0 },
          { id: '3', name: 'School Selection', nameZh: '选校建议', postCount: 0 },
          { id: '4', name: 'Team Up', nameZh: '组队找伴', postCount: 0 },
          { id: '5', name: 'Student Life', nameZh: '留学生活', postCount: 0 },
          { id: '6', name: 'Q&A', nameZh: '问答互助', postCount: 0 },
        ]);
      }
    };
    fetchData();
  }, []);

  // Fetch posts
  const fetchPosts = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        const currentPage = reset ? 1 : page;
        const limit = 10;
        const offset = (currentPage - 1) * limit;

        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(limit),
          sortBy,
        });
        if (selectedCategory) params.append('categoryId', selectedCategory);
        if (searchQuery) params.append('search', searchQuery);
        if (showTeamOnly) params.append('isTeamPost', 'true');
        if (postTag) params.append('postTag', postTag);

        const res = await api.get<{ posts: Post[]; total: number; hasMore: boolean }>(
          `/forums/posts?${params.toString()}`
        );
        if (res && res.posts) {
          setPosts(reset ? res.posts : [...posts, ...res.posts]);
          setHasMore(res.hasMore);
          if (reset) setPage(1);
        }
      } catch {
        setPosts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [page, sortBy, selectedCategory, searchQuery, showTeamOnly, postTag, posts]
  );

  useEffect(() => {
    fetchPosts(true);
  }, [sortBy, selectedCategory, showTeamOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Like post
  const handleLike = async (postId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await api.post<{ liked: boolean }>(`/forums/posts/${postId}/like`);
      if (res) {
        const updatePost = (p: Post) =>
          p.id === postId
            ? { ...p, isLiked: res.liked, likeCount: res.liked ? p.likeCount + 1 : p.likeCount - 1 }
            : p;
        setPosts(posts.map(updatePost));
      }
    } catch {
      const updatePost = (p: Post) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1 }
          : p;
      setPosts(posts.map(updatePost));
    }
  };

  const formatNumber = (num: number) => {
    return num >= 1000 ? format.number(num, 'compact') : num.toString();
  };

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategory);

  const aiContextActions: ContextAction[] = [
    {
      id: 'find-teammates',
      label: t('aiActions.findTeammates'),
      prompt: t('aiActions.findTeammatesPrompt'),
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: 'search-posts',
      label: t('aiActions.searchPosts'),
      prompt: t('aiActions.searchPostsPrompt'),
      icon: <Search className="h-4 w-4" />,
    },
    {
      id: 'trending-topics',
      label: t('aiActions.trendingTopics'),
      prompt: t('aiActions.trendingTopicsPrompt'),
      icon: <Flame className="h-4 w-4" />,
    },
    {
      id: 'ask-question',
      label: t('aiActions.askQuestion'),
      prompt: t('aiActions.askQuestionPrompt'),
      icon: <HelpCircle className="h-4 w-4" />,
    },
    {
      id: 'essay-feedback',
      label: t('aiActions.essayHelp'),
      prompt: t('aiActions.essayHelpPrompt'),
      icon: <PenLine className="h-4 w-4" />,
    },
  ];

  return (
    <PageContainer maxWidth="7xl">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: env.NEXT_PUBLIC_APP_URL },
          { name: 'Forum', url: `${env.NEXT_PUBLIC_APP_URL}/forum` },
        ]}
      />

      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={MessageSquare}
        color="blue"
        actions={
          <Button
            onClick={() => {
              setIsTeamPostCreate(false);
              setShowCreateDialog(true);
            }}
            className="gap-2"
          >
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">{t('createPost')}</span>
          </Button>
        }
        stats={[
          { label: t('stats.posts'), value: formatNumber(forumStats.postCount), icon: FileText },
          { label: t('stats.users'), value: formatNumber(forumStats.userCount), icon: Users },
          {
            label: t('stats.activeToday'),
            value: forumStats.activeToday,
            icon: TrendingUp,
            color: 'text-green-600',
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <CategorySidebar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          showTeamOnly={showTeamOnly}
          onToggleTeamOnly={() => setShowTeamOnly(!showTeamOnly)}
          forumStats={forumStats}
          locale={locale}
          suggestedTags={suggestedTags}
          onTagClick={(tag) => {
            setSearchQuery(tag);
            fetchPosts(true);
          }}
          onCreatePost={() => {
            setIsTeamPostCreate(false);
            setShowCreateDialog(true);
          }}
          onCreateTeamPost={() => {
            // Legacy team-post creation is hidden from the user surface.
          }}
          allowLegacyTeamPosts={false}
          formatNumber={formatNumber}
        />

        <div className="lg:col-span-9 space-y-4">
          {/* 组队专区：单独板块 */}
          <Card className="overflow-hidden border-2 border-amber-500/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 shadow-md shadow-amber-500/10">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                      <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    {t('teamSectionTitle')}
                    {forumStats.teamingCount > 0 && (
                      <Badge className="bg-amber-500 text-white border-0 text-xs animate-pulse">
                        {formatNumber(forumStats.teamingCount)} {t('activeLabel') || 'active'}
                      </Badge>
                    )}
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xl">{t('teamSectionDesc')}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    variant={showTeamOnly ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setShowTeamOnly(true);
                      setSelectedCategory(null);
                      fetchPosts(true);
                    }}
                  >
                    <Users className="h-4 w-4" />
                    {t('viewAllTeamPosts')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setIsTeamPostCreate(true);
                      setShowCreateDialog(true);
                    }}
                    disabled={!isVerified}
                  >
                    <PenLine className="h-4 w-4" />
                    {t('createTeamPost')}
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => setShowAiPanel(true)}>
                    <Bot className="h-4 w-4" />
                    {t('openAiToFindTeammates')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <PostList
            posts={posts}
            loading={loading}
            hasMore={hasMore}
            sortBy={sortBy}
            onSortChange={setSortBy}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearch={() => fetchPosts(true)}
            selectedCategoryObj={selectedCategoryObj}
            showTeamOnly={showTeamOnly}
            onClearCategory={() => setSelectedCategory(null)}
            onClearTeamOnly={() => setShowTeamOnly(false)}
            onClearSearch={() => setSearchQuery('')}
            onLoadMore={() => {
              setPage((p) => p + 1);
              fetchPosts();
            }}
            onViewPost={setSelectedPost}
            onLike={handleLike}
            onReport={setReportTarget}
            onCreatePost={() => setShowCreateDialog(true)}
          />
        </div>
      </div>

      <CreatePostDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        categories={categories}
        isVerified={isVerified}
        initialTeamPost={isTeamPostCreate}
        onPostCreated={() => fetchPosts(true)}
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

      {/* AI Assistant */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowAiPanel(true)}
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors ${showAiPanel ? 'hidden' : ''}`}
      >
        <Bot className="h-6 w-6" />
      </motion.button>

      <AiAssistantPanel
        isOpen={showAiPanel}
        onClose={() => setShowAiPanel(false)}
        title={t('aiTitle')}
        description={t('aiDesc')}
        contextActions={aiContextActions}
        initialMessage={t('aiWelcome')}
      />
    </PageContainer>
  );
}
