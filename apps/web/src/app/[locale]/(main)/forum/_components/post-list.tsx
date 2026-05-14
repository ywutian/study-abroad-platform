'use client';

import { useTranslations, useFormatter } from 'next-intl';
import {
  Eye,
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Community, ForumImage, Post } from './forum-types';
import { stripMarkdown } from './forum-types';

interface PostListProps {
  posts: Post[];
  loading: boolean;
  hasMore: boolean;
  sortBy: 'latest' | 'popular' | 'comments' | 'recommended';
  onSortChange: (sort: 'latest' | 'popular' | 'comments' | 'recommended') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  selectedCommunity: Community | null;
  activeFeed: 'popular' | 'home' | 'latest';
  onClearCommunity: () => void;
  onClearSearch: () => void;
  onLoadMore: () => void;
  onViewPost: (post: Post) => void;
  onLike: (postId: string, e?: React.MouseEvent) => void;
  onReport: (target: { type: 'POST' | 'COMMENT'; id: string }) => void;
  onCreatePost: () => void;
  onOpenCommunities: () => void;
}

export function PostList({
  posts,
  loading,
  hasMore,
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
  onSearch,
  selectedCommunity,
  activeFeed,
  onClearCommunity,
  onClearSearch,
  onLoadMore,
  onViewPost,
  onLike,
  onReport,
  onCreatePost,
  onOpenCommunities,
}: PostListProps) {
  const t = useTranslations('forum');
  const format = useFormatter();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('time.justNow');
    if (minutes < 60) return t('time.minutesAgo', { count: minutes });
    if (hours < 24) return t('time.hoursAgo', { count: hours });
    if (days < 7) return t('time.daysAgo', { count: days });
    return format.dateTime(date, 'short');
  };

  const formatNumber = (num: number) => {
    return num >= 1000 ? format.number(num, 'compact') : num.toString();
  };

  const sortOptions = [
    { key: 'latest' as const, label: t('sortLatest') },
    { key: 'popular' as const, label: t('sortPopular') },
    { key: 'comments' as const, label: t('sortComments') },
    { key: 'recommended' as const, label: t('sortRecommended') },
  ];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden py-0 lg:sticky lg:top-16 lg:z-20">
        <CardContent className="space-y-3 p-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 lg:hidden"
              onClick={onOpenCommunities}
              aria-label={t('openCommunities')}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t('chooseCommunity')}
            </Button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && onSearch()}
                placeholder={t('searchPostsPlaceholder')}
                className="pl-9"
              />
            </div>
            <Button className="shrink-0" onClick={onCreatePost}>
              <Plus className="mr-2 h-4 w-4" />
              {t('createPost')}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sortOptions.map((option) => (
              <Button
                key={option.key}
                variant={sortBy === option.key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onSortChange(option.key)}
              >
                {option.label}
              </Button>
            ))}
            <Badge variant="secondary" className="ml-auto gap-1">
              {selectedCommunity ? `r/${selectedCommunity.name}` : t(`feedLabel.${activeFeed}`)}
              {selectedCommunity && (
                <X className="h-3 w-3 cursor-pointer" onClick={onClearCommunity} />
              )}
            </Badge>
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                {t('searchLabel', { query: searchQuery })}
                <X className="h-3 w-3 cursor-pointer" onClick={onClearSearch} />
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="popLayout">
        {loading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="mb-1 text-lg font-medium text-muted-foreground">{t('noPosts')}</h3>
              <p className="mb-4 text-sm text-muted-foreground/70">{t('noPostsDesc')}</p>
              <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                <Button onClick={onCreatePost}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('firstPost')}
                </Button>
                <Button variant="outline" className="lg:hidden" onClick={onOpenCommunities}>
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  {t('chooseCommunity')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.02 }}
              >
                <PostCard
                  post={post}
                  formatDate={formatDate}
                  formatNumber={formatNumber}
                  onViewPost={onViewPost}
                  onLike={onLike}
                  onReport={onReport}
                />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {hasMore && posts.length > 0 && (
        <div className="pt-2 text-center">
          <Button variant="outline" onClick={onLoadMore} disabled={loading} className="min-w-48">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  formatDate,
  formatNumber,
  onViewPost,
  onLike,
  onReport,
}: {
  post: Post;
  formatDate: (date: string) => string;
  formatNumber: (num: number) => string;
  onViewPost: (post: Post) => void;
  onLike: (postId: string, e?: React.MouseEvent) => void;
  onReport: (target: { type: 'POST' | 'COMMENT'; id: string }) => void;
}) {
  const t = useTranslations('forum');

  return (
    <Card className="overflow-hidden py-0 shadow-none transition-colors hover:border-primary/40">
      <CardContent className="p-0">
        <button className="block w-full p-3 text-left sm:p-4" onClick={() => onViewPost(post)}>
          <div className="mb-2 flex items-start gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={post.author.avatar || ''} />
              <AvatarFallback>{(post.author.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  r/{post.community?.name || post.category?.name || t('uncategorized')}
                </span>
                <span>{t('postedBy', { name: post.author.name || t('anonymous') })}</span>
                <span>{formatDate(post.createdAt)}</span>
              </div>
              <h3 className="mt-1 line-clamp-2 text-base font-semibold text-foreground">
                {post.title}
              </h3>
            </div>
          </div>

          {post.content && (
            <p className="mb-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
              {stripMarkdown(post.content)}
            </p>
          )}

          {post.images.length > 0 && <ImageGrid images={post.images} />}
        </button>

        <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-muted-foreground sm:px-4">
          <div className="flex items-center gap-1.5">
            <button
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
                post.isLiked ? 'text-red-500' : 'hover:bg-muted hover:text-red-500'
              }`}
              onClick={(event) => onLike(post.id, event)}
              aria-label={t('likePost')}
            >
              <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
              {formatNumber(post.likeCount)}
            </button>
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-1">
              <MessageCircle className="h-4 w-4" />
              {formatNumber(post.commentCount)}
            </span>
            <span className="hidden items-center gap-1 rounded-md px-2 py-1 sm:inline-flex">
              <Eye className="h-4 w-4" />
              {formatNumber(post.viewCount)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="gap-1">
              <Share2 className="h-4 w-4" />
              {t('shareAction')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onReport({ type: 'POST', id: post.id })}
              aria-label={t('reportPost')}
            >
              <Flag className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ImageGrid({ images }: { images: ForumImage[] }) {
  const visible = images.slice(0, 4);
  const overflow = images.length - visible.length;
  const gridClass =
    visible.length === 1 ? 'grid-cols-1' : visible.length === 2 ? 'grid-cols-2' : 'grid-cols-2';

  return (
    <div className={`grid ${gridClass} gap-1 overflow-hidden rounded-md border bg-muted`}>
      {visible.map((image, index) => (
        <div
          key={image.id}
          className={`relative overflow-hidden bg-muted ${
            visible.length === 1 ? 'aspect-[16/9]' : 'aspect-square'
          }`}
        >
          <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          {overflow > 0 && index === visible.length - 1 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xl font-semibold text-white">
              +{overflow}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
