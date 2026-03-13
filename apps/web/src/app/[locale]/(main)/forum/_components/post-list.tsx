'use client';

import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Eye,
  Search,
  Plus,
  Clock,
  Flame,
  MessageCircle,
  Sparkles,
  X,
  Loader2,
  CheckCircle,
  MessageSquare,
  Flag,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Post, Category } from './forum-types';
import { getCategoryColorStyle, stripMarkdown } from './forum-types';

interface PostListProps {
  posts: Post[];
  loading: boolean;
  hasMore: boolean;
  sortBy: string;
  onSortChange: (sort: 'latest' | 'popular' | 'comments' | 'recommended') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  selectedCategoryObj: Category | undefined;
  showTeamOnly: boolean;
  onClearCategory: () => void;
  onClearTeamOnly: () => void;
  onClearSearch: () => void;
  onLoadMore: () => void;
  onViewPost: (post: Post) => void;
  onLike: (postId: string, e?: React.MouseEvent) => void;
  onReport: (target: { type: 'POST' | 'COMMENT'; id: string }) => void;
  onCreatePost: () => void;
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
  selectedCategoryObj,
  showTeamOnly,
  onClearCategory,
  onClearTeamOnly,
  onClearSearch,
  onLoadMore,
  onViewPost,
  onLike,
  onReport,
  onCreatePost,
}: PostListProps) {
  const t = useTranslations('forum');
  const locale = useLocale();
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

  return (
    <div className="lg:col-span-9 space-y-4">
      {/* Search & Filter Bar */}
      <Card className="overflow-hidden">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchPostsPlaceholder')}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                className="pl-9 bg-muted/50"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { key: 'latest', icon: Clock, label: t('sortLatest') },
                { key: 'popular', icon: Flame, label: t('sortPopular') },
                { key: 'comments', icon: MessageCircle, label: t('sortComments') },
                { key: 'recommended', icon: Sparkles, label: t('sortRecommended') },
              ].map(({ key, icon: Icon, label }) => (
                <Button
                  key={key}
                  variant={sortBy === key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() =>
                    onSortChange(key as 'latest' | 'popular' | 'comments' | 'recommended')
                  }
                  className={`whitespace-nowrap ${sortBy === key && key === 'recommended' ? 'bg-gradient-to-r from-purple-500 to-pink-500' : ''}`}
                >
                  <Icon className="h-3.5 w-3.5 mr-1" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Active Filters */}
          {(selectedCategoryObj || showTeamOnly || searchQuery) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <span className="text-xs text-muted-foreground">{t('currentFilterLabel')}</span>
              {selectedCategoryObj && (
                <Badge variant="secondary" className="gap-1">
                  {getLocalizedName(selectedCategoryObj.nameZh, selectedCategoryObj.name, locale)}
                  <X className="h-3 w-3 cursor-pointer" onClick={onClearCategory} />
                </Badge>
              )}
              {showTeamOnly && (
                <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
                  {t('teamPosts')}
                  <X className="h-3 w-3 cursor-pointer" onClick={onClearTeamOnly} />
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  {t('searchLabel', { query: searchQuery })}
                  <X className="h-3 w-3 cursor-pointer" onClick={onClearSearch} />
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts List */}
      <AnimatePresence mode="popLayout">
        {loading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-1">{t('noPosts')}</h3>
              <p className="text-muted-foreground/70 text-sm mb-4">{t('noPostsDesc')}</p>
              <Button onClick={onCreatePost}>
                <Plus className="h-4 w-4 mr-2" />
                {t('firstPost')}
              </Button>
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
                transition={{ delay: index * 0.03 }}
              >
                <Card
                  className={`overflow-hidden hover:shadow-md transition-all cursor-pointer group ${
                    post.isPinned ? 'ring-1 ring-amber-300 bg-amber-50/30' : ''
                  }`}
                  onClick={() => onViewPost(post)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {/* Avatar */}
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={post.author.avatar || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white text-sm">
                          {(post.author.name || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {post.isPinned && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-600 border-amber-200 text-xs py-0"
                            >
                              {t('pinned')}
                            </Badge>
                          )}
                          {post.isTeamPost && (
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs py-0">
                              <Users className="h-3 w-3 mr-0.5" />
                              {post.currentSize ?? 1}/{post.teamSize ?? 5}
                            </Badge>
                          )}
                          <Badge
                            className={`${getCategoryColorStyle(post.category).className || ''} text-white text-xs py-0`}
                            style={getCategoryColorStyle(post.category).style}
                          >
                            {getLocalizedName(post.category?.nameZh, post.category?.name, locale) ||
                              t('uncategorized')}
                          </Badge>
                        </div>

                        {/* Title */}
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1">
                          {post.title}
                        </h3>

                        {/* Content Preview */}
                        <p className="text-muted-foreground text-sm line-clamp-2 mb-2">
                          {stripMarkdown(post.content)}
                        </p>

                        {/* Tags */}
                        {post.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            {post.tags.slice(0, 4).map((tag) => (
                              <span
                                key={tag}
                                className="text-xs text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                            {post.tags.length > 4 && (
                              <span className="text-xs text-muted-foreground/70">
                                +{post.tags.length - 4}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <span className="font-medium text-muted-foreground">
                                {post.author.name || t('anonymous')}
                              </span>
                              {post.author.isVerified && (
                                <CheckCircle className="h-3 w-3 text-blue-500" />
                              )}
                            </span>
                            <span>{formatDate(post.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              {formatNumber(post.viewCount)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3.5 w-3.5" />
                              {post.commentCount}
                            </span>
                            <button
                              className={`flex items-center gap-1 transition-colors ${post.isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
                              onClick={(e) => onLike(post.id, e)}
                            >
                              <Heart
                                className={`h-3.5 w-3.5 ${post.isLiked ? 'fill-current' : ''}`}
                              />
                              {post.likeCount}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col items-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReport({ type: 'POST', id: post.id });
                          }}
                        >
                          <Flag className="h-4 w-4 text-muted-foreground/70 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Load More */}
      {hasMore && posts.length > 0 && (
        <div className="text-center pt-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
            className="min-w-[200px]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
