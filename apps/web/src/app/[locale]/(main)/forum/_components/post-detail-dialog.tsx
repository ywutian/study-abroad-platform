'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import {
  Users,
  Heart,
  Eye,
  MessageCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Bookmark,
  Share2,
  Send,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient as api } from '@/lib/api';
import type { Post, PostDetailResponse, Comment, TeamApplication } from './forum-types';
import { getCategoryColorStyle, renderMarkdown } from './forum-types';

interface PostDetailDialogProps {
  post: Post | null;
  onClose: () => void;
  onLike: (postId: string) => void;
  onReport: (target: { type: 'POST' | 'COMMENT'; id: string }) => void;
  user: { email?: string } | null;
}

export function PostDetailDialog({
  post,
  onClose,
  onLike,
  onReport: _onReport,
  user,
}: PostDetailDialogProps) {
  const t = useTranslations('forum');
  const locale = useLocale();
  const format = useFormatter();

  const [detail, setDetail] = useState<PostDetailResponse | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [applications, setApplications] = useState<TeamApplication[]>([]);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [userResumes, setUserResumes] = useState<Array<{ id: string; title: string }>>([]);

  // Load post detail when post changes
  useEffect(() => {
    if (!post) {
      setDetail(null);
      setComments([]);
      setApplications([]);
      return;
    }

    setDetail(post as PostDetailResponse);
    setLoadingComments(true);

    api
      .get<PostDetailResponse>(`/forums/posts/${post.id}`)
      .then((res) => {
        if (res && res.id) {
          setDetail(res);
          setComments(res.comments || []);
          setApplications(res.teamApplications || []);
        }
      })
      .catch(() => {
        setComments([]);
      })
      .finally(() => {
        setLoadingComments(false);
      });

    if (post.isTeamPost && user) {
      api
        .get<Array<{ id: string; title: string }>>('/resumes')
        .then((res) => setUserResumes(Array.isArray(res) ? res : []))
        .catch(() => setUserResumes([]));
    }
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handlePostComment = async () => {
    if (!commentContent.trim() || !detail) return;
    try {
      const res = await api.post<Comment>(`/forums/posts/${detail.id}/comments`, {
        content: commentContent,
      });
      if (res && res.id) {
        setComments([res, ...comments]);
        setCommentContent('');
        setDetail({ ...detail, commentCount: detail.commentCount + 1 });
      }
    } catch {
      const newComment: Comment = {
        id: String(Date.now()),
        content: commentContent,
        author: { id: 'me', name: user?.email?.split('@')[0] || t('anonymous'), isVerified: false },
        createdAt: new Date().toISOString(),
        likeCount: 0,
      };
      setComments([newComment, ...comments]);
      setCommentContent('');
    }
  };

  const handleApply = async (postId: string) => {
    if (!applicationMessage.trim()) return;
    try {
      await api.post(`/forums/posts/${postId}/apply`, {
        message: applicationMessage,
        ...(selectedResumeId && { resumeId: selectedResumeId }),
      });
      setApplicationMessage('');
      setSelectedResumeId('');
    } catch {
      // Error handled by global MutationCache toast
    }
  };

  const handleApplication = async (appId: string, action: 'accept' | 'reject') => {
    try {
      await api.post(`/forums/applications/${appId}/review`, {
        status: action === 'accept' ? 'ACCEPTED' : 'REJECTED',
      });
    } catch {
      // Optimistic update continues below regardless of API failure
    }
    setApplications(
      applications.map((a) =>
        a.id === appId ? { ...a, status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' } : a
      )
    );
  };

  const showPostDetail = detail;

  return (
    <>
      <Dialog open={!!post} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogTitle className="sr-only">{showPostDetail?.title || t('postDetail')}</DialogTitle>
          {showPostDetail && (
            <>
              {/* Header */}
              <div className="p-6 pb-4 border-b shrink-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {showPostDetail.isPinned && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-600 border-amber-200 text-xs"
                    >
                      {t('pinned')}
                    </Badge>
                  )}
                  {showPostDetail.isTeamPost && (
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {showPostDetail.currentSize ?? 1}/{showPostDetail.teamSize ?? 5}
                    </Badge>
                  )}
                  <Badge
                    className={`${getCategoryColorStyle(showPostDetail.category).className || ''} text-white text-xs`}
                    style={getCategoryColorStyle(showPostDetail.category).style}
                  >
                    {getLocalizedName(
                      showPostDetail.category?.nameZh,
                      showPostDetail.category?.name,
                      locale
                    ) || t('uncategorized')}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold text-foreground mb-3">{showPostDetail.title}</h2>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={showPostDetail.author.avatar || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white text-sm">
                      {(showPostDetail.author.name || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm">
                        {showPostDetail.author.name || t('anonymous')}
                      </span>
                      {showPostDetail.author.isVerified && (
                        <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(showPostDetail.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose prose-sm max-w-none text-muted-foreground mb-6">
                  {renderMarkdown(showPostDetail.content)}
                </div>

                {/* Team Info */}
                {showPostDetail.isTeamPost && (
                  <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 mb-6">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4" />
                        {t('teamInfo')}
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-muted-foreground">{t('currentMembersLabel')}</span>
                          <p className="font-medium">
                            {t('memberCount', {
                              current: showPostDetail.currentSize ?? 1,
                              total: showPostDetail.teamSize ?? 5,
                            })}
                          </p>
                        </div>
                        {showPostDetail.teamDeadline && (
                          <div>
                            <span className="text-muted-foreground">{t('teamDeadlineLabel')}</span>
                            <p className="font-medium">
                              {format.dateTime(new Date(showPostDetail.teamDeadline), 'medium')}
                            </p>
                          </div>
                        )}
                        {showPostDetail.requirements && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">
                              {t('recruitRequirements')}
                            </span>
                            <p className="mt-1 text-muted-foreground">
                              {showPostDetail.requirements}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-lg border border-amber-200 bg-white/70 p-3 text-sm text-amber-900">
                          {locale === 'zh'
                            ? '论坛组队帖已切为 legacy 只读，历史内容可看但不能再申请加入。请到 /teams 发起新的比赛组队匹配。'
                            : 'Legacy forum team posts are now read-only. Historical content stays visible, but new applications are disabled. Use /teams for live competition matching.'}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            window.location.href = '/teams';
                          }}
                        >
                          {locale === 'zh' ? '前往 /teams' : 'Open /teams'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Tags */}
                {showPostDetail.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {showPostDetail.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-sm text-primary bg-primary/5 px-2 py-1 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats Bar */}
                <div className="flex items-center gap-4 py-4 border-y mb-6">
                  <button
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all ${
                      showPostDetail.isLiked
                        ? 'bg-red-100 text-red-500'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                    onClick={() => onLike(showPostDetail.id)}
                  >
                    <Heart className={`h-5 w-5 ${showPostDetail.isLiked ? 'fill-current' : ''}`} />
                    <span className="font-medium">{showPostDetail.likeCount}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Eye className="h-5 w-5" />
                    <span>{formatNumber(showPostDetail.viewCount)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageCircle className="h-5 w-5" />
                    <span>{showPostDetail.commentCount}</span>
                  </div>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm">
                    <Bookmark className="h-4 w-4 mr-1" />
                    {t('bookmarkAction')}
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Share2 className="h-4 w-4 mr-1" />
                    {t('shareAction')}
                  </Button>
                </div>

                {/* Comments */}
                <div>
                  <h4 className="font-semibold mb-4">
                    {t('commentsTitle', { count: comments.length })}
                  </h4>

                  {/* Comment Input */}
                  <div className="flex gap-3 mb-6">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        placeholder={t('writeComment')}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePostComment()}
                      />
                      <Button onClick={handlePostComment} disabled={!commentContent.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Comments List */}
                  {loadingComments ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground/70">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>{t('noComments')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="space-y-3">
                          <div className="flex gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={comment.author.avatar || ''} />
                              <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                                {(comment.author.name || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {comment.author.name || t('anonymous')}
                                </span>
                                {comment.author.isVerified && (
                                  <CheckCircle className="h-3 w-3 text-blue-500" />
                                )}
                                <span className="text-xs text-muted-foreground/70">
                                  {formatDate(comment.createdAt)}
                                </span>
                              </div>
                              <p className="text-muted-foreground text-sm">{comment.content}</p>
                            </div>
                          </div>
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="ml-11 space-y-3 pl-3 border-l-2 border-border">
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="flex gap-3">
                                  <Avatar className="h-6 w-6 shrink-0">
                                    <AvatarImage src={reply.author.avatar || ''} />
                                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                      {(reply.author.name || 'U').charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-medium text-sm">
                                        {reply.author.name || t('anonymous')}
                                      </span>
                                      {reply.author.isVerified && (
                                        <CheckCircle className="h-3 w-3 text-blue-500" />
                                      )}
                                      <span className="text-xs text-muted-foreground/70">
                                        {formatDate(reply.createdAt)}
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground text-sm">{reply.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Applications Dialog */}
      {detail?.isTeamPost && applications.length > 0 && (
        <Dialog open={false}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-500" />
                {t('reviewAppsTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {applications.map((app) => (
                <Card key={app.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={app.applicant.avatar || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {(app.applicant.name || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {app.applicant.name || t('anonymous')}
                          </span>
                          {app.applicant.isVerified && (
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                          )}
                          <Badge
                            variant={
                              app.status === 'ACCEPTED'
                                ? 'default'
                                : app.status === 'REJECTED'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {app.status === 'ACCEPTED'
                              ? t('appApproved')
                              : app.status === 'REJECTED'
                                ? t('appDenied')
                                : t('appWaiting')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {app.message || t('noAdditionalInfo')}
                        </p>
                        <span className="text-xs text-muted-foreground/70">
                          {formatDate(app.createdAt)}
                        </span>
                      </div>
                      {app.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30"
                            onClick={() => handleApplication(app.id, 'accept')}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => handleApplication(app.id, 'reject')}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
