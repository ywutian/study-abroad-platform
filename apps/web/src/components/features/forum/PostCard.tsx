'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import {
  Eye,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Flag,
  Pin,
  Users,
  Clock,
  BadgeCheck,
} from 'lucide-react';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Post, ForumPostTag } from '@/types/forum';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';

// 数字格式化 — 在组件内通过 useFormatter 实现本地化

// 标签配置
const TAG_VARIANTS: Record<
  ForumPostTag,
  { variant: 'warning' | 'info' | 'purple' | 'success' | 'secondary'; icon: string }
> = {
  COMPETITION: { variant: 'warning', icon: '🏆' },
  ACTIVITY: { variant: 'info', icon: '🎯' },
  QUESTION: { variant: 'purple', icon: '❓' },
  SHARING: { variant: 'success', icon: '📝' },
  OTHER: { variant: 'secondary', icon: '📌' },
};

interface PostCardProps {
  post: Post;
  index: number;
  onLike: (postId: string) => void;
  onReport: (postId: string) => void;
  onClick: (post: Post) => void;
}

export function PostCard({ post, index, onLike, onReport, onClick }: PostCardProps) {
  const t = useTranslations('forum');
  const locale = useLocale();
  const format = useFormatter();
  const dateLocale = locale === 'zh' ? zhCN : enUS;

  const formatNumber = (num: number) =>
    num >= 1000 ? format.number(num, 'compact') : num.toString();

  const tagConfig = post.postTag ? TAG_VARIANTS[post.postTag] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2 }}
    >
      <Card
        className={cn(
          'group cursor-pointer transition-all duration-200',
          'hover:shadow-lg hover:border-primary/20',
          'bg-card/80 backdrop-blur-sm',
          post.isPinned && 'ring-2 ring-amber-400/50 bg-amber-50/5 dark:bg-amber-950/10'
        )}
        onClick={() => onClick(post)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {post.isPinned && (
                <Badge variant="warning" className="gap-1">
                  <Pin className="h-3 w-3" />
                  {t('pinned')}
                </Badge>
              )}
              {tagConfig && (
                <Badge variant={tagConfig.variant}>
                  {tagConfig.icon} {t(`tag${post.postTag}`)}
                </Badge>
              )}
              {post.isTeamPost && post.teamStatus === 'RECRUITING' && (
                <Badge variant="success" className="gap-1">
                  <Users className="h-3 w-3" />
                  {t('teamRecruiting')} {post.currentSize}/{post.teamSize}
                </Badge>
              )}
              {post.isTeamPost && post.teamStatus === 'FULL' && (
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {t('teamFull')}
                </Badge>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onReport(post.id);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  {t('report')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <h3 className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors mt-2">
            {post.title}
          </h3>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>

          {/* 组队信息 */}
          {post.isTeamPost && post.teamDeadline && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {t('deadline')}: {format.dateTime(new Date(post.teamDeadline), 'medium')}
              </span>
            </div>
          )}

          {/* 标签 */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  #{tag}
                </Badge>
              ))}
              {post.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{post.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* 作者信息 */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 border">
                {post.author.avatar ? (
                  <AvatarImage src={post.author.avatar} alt={post.author.name || ''} />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {post.author.name?.[0] || '?'}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">{post.author.name || t('anonymous')}</span>
                  {post.author.isVerified && <BadgeCheck className="h-4 w-4 text-emerald-500" />}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.createdAt), {
                    addSuffix: true,
                    locale: dateLocale,
                  })}
                </span>
              </div>
            </div>

            {/* 统计数据 */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {formatNumber(post.viewCount)}
              </span>
              <button
                className={cn(
                  'flex items-center gap-1 transition-colors',
                  post.isLiked ? 'text-rose-500' : 'hover:text-rose-500'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onLike(post.id);
                }}
              >
                <Heart className={cn('h-3.5 w-3.5', post.isLiked && 'fill-current')} />
                {formatNumber(post.likeCount)}
              </button>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                {formatNumber(post.commentCount)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
