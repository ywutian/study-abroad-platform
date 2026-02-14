'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Users,
  Heart,
  Eye,
  Search,
  Plus,
  Filter,
  Clock,
  Flame,
  MessageCircle,
  Trophy,
  Sparkles,
  BookOpen,
  HelpCircle,
  FolderOpen,
  X,
  Send,
  UserPlus,
  CheckCircle,
  XCircle,
  Loader2,
  TrendingUp,
  Bookmark,
  Share2,
  PenLine,
  Globe,
  Home,
  FileText,
} from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient as api } from '@/lib/api';
import { ReportDialog } from '@/components/features/forum/ReportDialog';
import { useAuthStore } from '@/stores/auth';
import { Flag, ShieldAlert, ArrowRight, Bot } from 'lucide-react';
import Link from 'next/link';
import { AiAssistantPanel, type ContextAction } from '@/components/features/agent-chat';

// Types
interface Category {
  id: string;
  name: string;
  nameZh: string;
  description?: string;
  descriptionZh?: string;
  color?: string;
  icon?: string;
  postCount: number;
}

interface Author {
  id: string;
  name?: string;
  avatar?: string;
  isVerified: boolean;
}

interface Post {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  category: Category;
  author: Author;
  isTeamPost: boolean;
  teamSize?: number;
  currentSize?: number;
  teamDeadline?: string;
  requirements?: string;
  teamStatus?: string;
  tags: string[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  isLiked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  author: Author;
  createdAt: string;
  parentId?: string;
  likeCount: number;
  replies?: Comment[];
}

interface TeamApplication {
  id: string;
  applicant: Author;
  message?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

interface PostDetailResponse extends Post {
  comments: Comment[];
  teamMembers?: { id: string; user: Author; role: string; joinedAt: string }[];
  teamApplications?: TeamApplication[];
}

// Helper functions
const getCategoryIcon = (category: Category): React.ReactNode => {
  const nameLC = (category.name || category.nameZh || '').toLowerCase();
  if (nameLC.includes('team') || nameLC.includes('组队')) return <Trophy className="h-4 w-4" />;
  if (nameLC.includes('activity') || nameLC.includes('活动'))
    return <Sparkles className="h-4 w-4" />;
  if (nameLC.includes('experience') || nameLC.includes('经验'))
    return <BookOpen className="h-4 w-4" />;
  if (nameLC.includes('question') || nameLC.includes('问答') || nameLC.includes('q&a'))
    return <HelpCircle className="h-4 w-4" />;
  if (nameLC.includes('resource') || nameLC.includes('资源'))
    return <FolderOpen className="h-4 w-4" />;
  if (nameLC.includes('life') || nameLC.includes('生活')) return <Globe className="h-4 w-4" />;
  if (nameLC.includes('essay') || nameLC.includes('文书')) return <FileText className="h-4 w-4" />;
  if (nameLC.includes('school') || nameLC.includes('选校')) return <Home className="h-4 w-4" />;
  return <MessageSquare className="h-4 w-4" />;
};

const getCategoryColorStyle = (
  category: Category
): { className?: string; style?: React.CSSProperties } => {
  if (category.color) {
    return { style: { background: category.color } };
  }
  const nameLC = (category.name || category.nameZh || '').toLowerCase();
  if (nameLC.includes('team') || nameLC.includes('组队'))
    return { className: 'bg-gradient-to-r from-amber-500 to-orange-500' };
  if (nameLC.includes('activity') || nameLC.includes('活动')) return { className: 'bg-primary' };
  if (nameLC.includes('experience') || nameLC.includes('经验'))
    return { className: 'bg-gradient-to-r from-emerald-500 to-teal-500' };
  if (nameLC.includes('question') || nameLC.includes('问答') || nameLC.includes('q&a'))
    return { className: 'bg-gradient-to-r from-pink-500 to-rose-500' };
  if (nameLC.includes('resource') || nameLC.includes('资源'))
    return { className: 'bg-gradient-to-r from-violet-500 to-purple-500' };
  if (nameLC.includes('life') || nameLC.includes('生活'))
    return { className: 'bg-gradient-to-r from-orange-400 to-amber-500' };
  if (nameLC.includes('essay') || nameLC.includes('文书'))
    return { className: 'bg-gradient-to-r from-blue-500 to-cyan-500' };
  if (nameLC.includes('school') || nameLC.includes('选校'))
    return { className: 'bg-gradient-to-r from-teal-500 to-emerald-500' };
  return { className: 'bg-gray-500' };
};

const stripMarkdown = (content: string): string => {
  return content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*+]\s*/gm, '• ')
    .replace(/^\d+\.\s*/gm, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
};

// Simple markdown renderer for post detail (with XSS sanitization)
const renderMarkdown = (content: string): React.ReactNode => {
  const sanitize = (html: string): string => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['strong', 'em', 'a', 'code'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  };

  const lines = content.split('\n');
  return lines.map((line, i) => {
    // Bold
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Headers
    if (line.startsWith('# ')) {
      return (
        <h2 key={i} className="text-xl font-bold mt-4 mb-2">
          {line.slice(2)}
        </h2>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={i} className="text-lg font-semibold mt-3 mb-2">
          {line.slice(3)}
        </h3>
      );
    }
    // List items
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li
          key={i}
          className="ml-4 list-disc"
          dangerouslySetInnerHTML={{ __html: sanitize(line.slice(2)) }}
        />
      );
    }
    if (/^\d+\.\s/.test(line)) {
      return (
        <li
          key={i}
          className="ml-4 list-decimal"
          dangerouslySetInnerHTML={{ __html: sanitize(line.replace(/^\d+\.\s/, '')) }}
        />
      );
    }
    // Empty line
    if (!line.trim()) {
      return <br key={i} />;
    }
    // Normal paragraph
    return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: sanitize(line) }} />;
  });
};

export default function ForumPage() {
  const t = useTranslations('forum');
  const locale = useLocale();
  const format = useFormatter();
  const { user } = useAuthStore();
  const isVerified = user?.role === 'VERIFIED' || user?.role === 'ADMIN';

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
  const [showPostDetail, setShowPostDetail] = useState<PostDetailResponse | null>(null);
  const [showApplications, setShowApplications] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTagInput, setFormTagInput] = useState('');
  const [isTeamPost, setIsTeamPost] = useState(false);
  const [formTeamSize, setFormTeamSize] = useState(5);
  const [formDeadline, setFormDeadline] = useState('');
  const [formRequirements, setFormRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [_showPreview, setShowPreview] = useState(false);

  // Detail states
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [applications, setApplications] = useState<TeamApplication[]>([]);
  const [applicationMessage, setApplicationMessage] = useState('');

  // Stats
  const [forumStats, setForumStats] = useState({
    postCount: 0,
    userCount: 0,
    teamingCount: 0,
    activeToday: 0,
  });

  // Suggested tags for quick selection
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
        if (categoriesRes && categoriesRes.length > 0) {
          setCategories(categoriesRes);
        }
        if (statsRes) {
          setForumStats(statsRes);
        }
      } catch (_error) {
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
          sortBy: sortBy,
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
      } catch (_error) {
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
  }, [sortBy, selectedCategory, showTeamOnly]);

  // Form handlers
  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormCategory('');
    setFormTags([]);
    setFormTagInput('');
    setIsTeamPost(false);
    setFormTeamSize(5);
    setFormDeadline('');
    setFormRequirements('');
    setShowPreview(false);
  };

  const handleCreatePost = async () => {
    if (!formTitle.trim() || !formContent.trim() || !formCategory) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: formTitle,
        content: formContent,
        categoryId: formCategory,
        tags: formTags,
        isTeamPost,
      };
      if (isTeamPost) {
        payload.teamSize = formTeamSize;
        payload.teamDeadline = formDeadline;
        payload.requirements = formRequirements;
      }

      const res = await api.post<Post>('/forums/posts', payload);
      if (res && res.id) {
        setShowCreateDialog(false);
        resetForm();
        fetchPosts(true);
      }
    } catch (_error) {
      console.error('Failed to create post:', _error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && formTagInput.trim()) {
      e.preventDefault();
      addTag(formTagInput.trim());
    }
  };

  const addTag = (tag: string) => {
    if (!formTags.includes(tag) && formTags.length < 5) {
      setFormTags([...formTags, tag]);
    }
    setFormTagInput('');
  };

  const removeTag = (tag: string) => {
    setFormTags(formTags.filter((t) => t !== tag));
  };

  // Like post
  const handleLike = async (postId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await api.post<{ liked: boolean }>(`/forums/posts/${postId}/like`);
      if (res) {
        const updatePost = (p: Post) =>
          p.id === postId
            ? {
                ...p,
                isLiked: res.liked,
                likeCount: res.liked ? p.likeCount + 1 : p.likeCount - 1,
              }
            : p;
        setPosts(posts.map(updatePost));
        if (showPostDetail?.id === postId) {
          setShowPostDetail({
            ...showPostDetail,
            isLiked: res.liked,
            likeCount: res.liked ? showPostDetail.likeCount + 1 : showPostDetail.likeCount - 1,
          });
        }
      }
    } catch {
      // Optimistic toggle
      const updatePost = (p: Post) =>
        p.id === postId
          ? {
              ...p,
              isLiked: !p.isLiked,
              likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1,
            }
          : p;
      setPosts(posts.map(updatePost));
    }
  };

  // View post detail
  const viewPostDetail = async (post: Post) => {
    setShowPostDetail(post as PostDetailResponse);
    setLoadingComments(true);
    try {
      const res = await api.get<PostDetailResponse>(`/forums/posts/${post.id}`);
      if (res && res.id) {
        setShowPostDetail(res);
        setComments(res.comments || []);
        setApplications(res.teamApplications || []);
      }
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  // Post comment
  const handlePostComment = async () => {
    if (!commentContent.trim() || !showPostDetail) return;
    try {
      const res = await api.post<Comment>(`/forums/posts/${showPostDetail.id}/comments`, {
        content: commentContent,
      });
      if (res && res.id) {
        setComments([res, ...comments]);
        setCommentContent('');
        setShowPostDetail({ ...showPostDetail, commentCount: showPostDetail.commentCount + 1 });
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

  // Team application
  const handleApply = async (postId: string) => {
    if (!applicationMessage.trim()) return;
    try {
      await api.post(`/forums/posts/${postId}/apply`, { message: applicationMessage });
      setApplicationMessage('');
    } catch (_error) {
      console.error('Failed to apply:', _error);
    }
  };

  const handleApplication = async (appId: string, action: 'accept' | 'reject') => {
    try {
      await api.post(`/forums/applications/${appId}/review`, {
        status: action === 'accept' ? 'ACCEPTED' : 'REJECTED',
      });
    } catch {}
    setApplications(
      applications.map((a) =>
        a.id === appId ? { ...a, status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' } : a
      )
    );
  };

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

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Compact Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-body-lg font-semibold">{t('title')}</h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {t('description')}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span className="font-medium">{formatNumber(forumStats.postCount)}</span>
                <span className="text-xs">{t('stats.posts')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="font-medium">{formatNumber(forumStats.userCount)}</span>
                <span className="text-xs">{t('stats.users')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium">{forumStats.activeToday}</span>
                <span className="text-xs">{t('stats.activeToday')}</span>
              </div>
            </div>

            {/* Create Button */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setIsTeamPost(false);
                  setShowCreateDialog(true);
                }}
                className="gap-2"
              >
                <PenLine className="h-4 w-4" />
                <span className="hidden sm:inline">{t('createPost')}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-4">
            {/* Categories */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 bg-gradient-to-r from-primary/5 to-primary/10">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  {t('categoryFilter')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-1">
                  <button
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedCategory === null && !showTeamOnly
                        ? 'bg-primary text-white'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setSelectedCategory(null);
                      setShowTeamOnly(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {t('allPosts')}
                    </span>
                    <span className="text-xs opacity-70">{forumStats.postCount}</span>
                  </button>

                  <button
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                      showTeamOnly
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setShowTeamOnly(!showTeamOnly);
                      setSelectedCategory(null);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('teamPosts')}
                    </span>
                    <span className="text-xs opacity-70">{forumStats.teamingCount}</span>
                  </button>

                  <div className="h-px bg-gray-100 my-2" />

                  {categories.map((category) => {
                    const colorStyle = getCategoryColorStyle(category);
                    const isSelected = selectedCategory === category.id;
                    return (
                      <button
                        key={category.id}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                          isSelected ? 'text-white' : 'hover:bg-gray-100'
                        } ${isSelected ? colorStyle.className : ''}`}
                        style={isSelected ? colorStyle.style : undefined}
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setShowTeamOnly(false);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          {getCategoryIcon(category)}
                          {getLocalizedName(category.nameZh, category.name, locale)}
                        </span>
                        <span className="text-xs opacity-70">{category.postCount}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Create */}
            <Card className="bg-gradient-to-br from-primary to-blue-600 text-white overflow-hidden">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">{t('quickPost')}</h3>
                <p className="text-sm text-white/80 mb-3">{t('quickPostDesc')}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur"
                    onClick={() => {
                      setIsTeamPost(false);
                      setShowCreateDialog(true);
                    }}
                  >
                    <PenLine className="h-3.5 w-3.5 mr-1" />
                    {t('postAction')}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur"
                    onClick={() => {
                      setIsTeamPost(true);
                      setShowCreateDialog(true);
                    }}
                  >
                    <Users className="h-3.5 w-3.5 mr-1" />
                    {t('teamUp')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Hot Tags */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  {t('hotTags')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTags.slice(0, 10).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-white transition-colors text-xs"
                      onClick={() => {
                        setSearchQuery(tag);
                        fetchPosts(true);
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
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
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchPosts(true)}
                      className="pl-9 bg-gray-50/50"
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
                        onClick={() => setSortBy(key as typeof sortBy)}
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
                        {getLocalizedName(
                          selectedCategoryObj.nameZh,
                          selectedCategoryObj.name,
                          locale
                        )}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setSelectedCategory(null)}
                        />
                      </Badge>
                    )}
                    {showTeamOnly && (
                      <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
                        {t('teamPosts')}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setShowTeamOnly(false)}
                        />
                      </Badge>
                    )}
                    {searchQuery && (
                      <Badge variant="secondary" className="gap-1">
                        {t('searchLabel', { query: searchQuery })}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery('')} />
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
                    <MessageSquare className="h-12 w-12 mx-auto text-gray-200 mb-4" />
                    <h3 className="text-lg font-medium text-gray-500 mb-1">{t('noPosts')}</h3>
                    <p className="text-gray-400 text-sm mb-4">{t('noPostsDesc')}</p>
                    <Button onClick={() => setShowCreateDialog(true)}>
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
                        onClick={() => viewPostDetail(post)}
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
                                  {getLocalizedName(
                                    post.category?.nameZh,
                                    post.category?.name,
                                    locale
                                  ) || t('uncategorized')}
                                </Badge>
                              </div>

                              {/* Title */}
                              <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-1 mb-1">
                                {post.title}
                              </h3>

                              {/* Content Preview */}
                              <p className="text-gray-500 text-sm line-clamp-2 mb-2">
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
                                    <span className="text-xs text-gray-400">
                                      +{post.tags.length - 4}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Footer */}
                              <div className="flex items-center justify-between text-xs text-gray-400">
                                <div className="flex items-center gap-3">
                                  <span className="flex items-center gap-1">
                                    <span className="font-medium text-gray-600">
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
                                    onClick={(e) => handleLike(post.id, e)}
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
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportTarget({ type: 'POST', id: post.id });
                                }}
                              >
                                <Flag className="h-4 w-4 text-gray-400 hover:text-red-500" />
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
                  onClick={() => {
                    setPage((p) => p + 1);
                    fetchPosts();
                  }}
                  disabled={loading}
                  className="min-w-[200px]"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('loadMore')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Post Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {isTeamPost ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  {t('createTeamPost')}
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <PenLine className="h-4 w-4 text-white" />
                  </div>
                  {t('createNewPost')}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <Tabs defaultValue="edit" className="w-full">
              <TabsList className="w-full grid grid-cols-2 mb-4">
                <TabsTrigger value="edit" onClick={() => setShowPreview(false)}>
                  {t('editTab')}
                </TabsTrigger>
                <TabsTrigger value="preview" onClick={() => setShowPreview(true)}>
                  {t('previewTab')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-4 mt-0">
                {/* Post Type Toggle */}
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
                  <button
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      !isTeamPost ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setIsTeamPost(false)}
                  >
                    {t('normalPost')}
                  </button>
                  <button
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                      isTeamPost
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => isVerified && setIsTeamPost(true)}
                    disabled={!isVerified}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {t('teamPosts')}
                  </button>
                </div>

                {!isVerified && isTeamPost && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="flex items-center justify-between text-amber-800">
                      <span className="text-sm">{t('verificationRequired')}</span>
                      <Link
                        href="/verification"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"
                      >
                        {t('goVerify')} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Title */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    {t('postTitleLabel')}
                  </label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={t('postTitlePlaceholder')}
                    className="text-base"
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{formTitle.length}/100</p>
                </div>

                {/* Category */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    {t('categoryLabel')}
                  </label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectPostCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            {getCategoryIcon(cat)}
                            {locale === 'zh' ? cat.nameZh || cat.name : cat.name || cat.nameZh}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Content */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    {t('contentLabel')}
                  </label>
                  <Textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder={t('contentPlaceholder')}
                    className="min-h-[200px] resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {t('charCount', { count: formContent.length })}
                  </p>
                </div>

                {/* Team Options */}
                {isTeamPost && (
                  <div className="space-y-4 p-4 bg-amber-50/50 rounded-lg border border-amber-100">
                    <h4 className="font-medium text-amber-800 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('teamSettingsTitle')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-600 mb-1.5 block">
                          {t('teamMembersLabel')}
                        </label>
                        <Input
                          type="number"
                          value={formTeamSize}
                          onChange={(e) => setFormTeamSize(Number(e.target.value))}
                          min={2}
                          max={20}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 mb-1.5 block">
                          {t('teamDeadlineLabel')}
                        </label>
                        <Input
                          type="date"
                          value={formDeadline}
                          onChange={(e) => setFormDeadline(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1.5 block">
                        {t('teamRequirementsDesc')}
                      </label>
                      <Textarea
                        value={formRequirements}
                        onChange={(e) => setFormRequirements(e.target.value)}
                        placeholder={t('teamReqPlaceholder')}
                        className="min-h-[80px] resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    {t('maxTags')}
                  </label>
                  {formTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {formTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                          #{tag}
                          <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={formTagInput}
                      onChange={(e) => setFormTagInput(e.target.value)}
                      onKeyDown={handleTagInput}
                      placeholder={t('tagsPlaceholder')}
                      disabled={formTags.length >= 5}
                    />
                  </div>
                  {formTags.length < 5 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {suggestedTags
                        .filter((t) => !formTags.includes(t))
                        .slice(0, 8)
                        .map((tag) => (
                          <button
                            key={tag}
                            className="text-xs text-gray-500 hover:text-primary hover:bg-primary/5 px-2 py-0.5 rounded transition-colors"
                            onClick={() => addTag(tag)}
                          >
                            +{tag}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-0">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      {formCategory &&
                        (() => {
                          const category = categories.find((c) => c.id === formCategory);
                          return (
                            <Badge
                              className={`${category ? getCategoryColorStyle(category).className : 'bg-gray-500'} text-white text-xs`}
                            >
                              {getLocalizedName(category?.nameZh, category?.name, locale) ||
                                t('unchosenCategory')}
                            </Badge>
                          );
                        })()}
                      {isTeamPost && (
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {t('teamProgress', { current: 1, total: formTeamSize })}
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-xl font-bold mb-3">{formTitle || t('postTitlePreview')}</h2>
                    <div className="prose prose-sm max-w-none text-gray-700">
                      {formContent ? (
                        renderMarkdown(formContent)
                      ) : (
                        <p className="text-gray-400">{t('contentPreviewText')}</p>
                      )}
                    </div>
                    {formTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t">
                        {formTags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs text-primary bg-primary/5 px-2 py-1 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t shrink-0">
            <p className="text-xs text-muted-foreground">{t('agreeRules')}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreatePost}
                disabled={submitting || !formTitle.trim() || !formContent.trim() || !formCategory}
                className={
                  isTeamPost
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                    : ''
                }
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isTeamPost ? t('publishTeam') : t('publishPost')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Detail Dialog */}
      <Dialog open={!!showPostDetail} onOpenChange={() => setShowPostDetail(null)}>
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
                <h2 className="text-xl font-bold text-gray-900 mb-3">{showPostDetail.title}</h2>
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
                <div className="prose prose-sm max-w-none text-gray-700 mb-6">
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
                          <span className="text-gray-500">{t('currentMembersLabel')}</span>
                          <p className="font-medium">
                            {t('memberCount', {
                              current: showPostDetail.currentSize ?? 1,
                              total: showPostDetail.teamSize ?? 5,
                            })}
                          </p>
                        </div>
                        {showPostDetail.teamDeadline && (
                          <div>
                            <span className="text-gray-500">{t('teamDeadlineLabel')}</span>
                            <p className="font-medium">
                              {format.dateTime(new Date(showPostDetail.teamDeadline), 'medium')}
                            </p>
                          </div>
                        )}
                        {showPostDetail.requirements && (
                          <div className="col-span-2">
                            <span className="text-gray-500">{t('recruitRequirements')}</span>
                            <p className="mt-1 text-gray-700">{showPostDetail.requirements}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={applicationMessage}
                          onChange={(e) => setApplicationMessage(e.target.value)}
                          placeholder={t('joinPlaceholder')}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleApply(showPostDetail.id)}
                          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                          disabled={!applicationMessage.trim()}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          {t('joinTeam')}
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
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    onClick={() => handleLike(showPostDetail.id)}
                  >
                    <Heart className={`h-5 w-5 ${showPostDetail.isLiked ? 'fill-current' : ''}`} />
                    <span className="font-medium">{showPostDetail.likeCount}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Eye className="h-5 w-5" />
                    <span>{formatNumber(showPostDetail.viewCount)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
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
                    <div className="text-center py-8 text-gray-400">
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
                              <AvatarFallback className="bg-gray-100 text-gray-600 text-sm">
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
                                <span className="text-xs text-gray-400">
                                  {formatDate(comment.createdAt)}
                                </span>
                              </div>
                              <p className="text-gray-700 text-sm">{comment.content}</p>
                            </div>
                          </div>
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="ml-11 space-y-3 pl-3 border-l-2 border-gray-100">
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="flex gap-3">
                                  <Avatar className="h-6 w-6 shrink-0">
                                    <AvatarImage src={reply.author.avatar || ''} />
                                    <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
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
                                      <span className="text-xs text-gray-400">
                                        {formatDate(reply.createdAt)}
                                      </span>
                                    </div>
                                    <p className="text-gray-700 text-sm">{reply.content}</p>
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
      <Dialog open={!!showApplications} onOpenChange={() => setShowApplications(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-500" />
              {t('reviewAppsTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {applications.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t('noApps')}</p>
            ) : (
              applications.map((app) => (
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
                        <p className="text-sm text-gray-600">
                          {app.message || t('noAdditionalInfo')}
                        </p>
                        <span className="text-xs text-gray-400">{formatDate(app.createdAt)}</span>
                      </div>
                      {app.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handleApplication(app.id, 'accept')}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleApplication(app.id, 'reject')}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <ReportDialog
        open={reportTarget !== null}
        onOpenChange={(open) => !open && setReportTarget(null)}
        targetType={reportTarget?.type || 'POST'}
        targetId={reportTarget?.id || ''}
      />

      {/* AI 助手触发按钮 */}
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

      {/* AI 助手面板 */}
      <AiAssistantPanel
        isOpen={showAiPanel}
        onClose={() => setShowAiPanel(false)}
        title={t('aiTitle')}
        description={t('aiDesc')}
        contextActions={
          [
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
              id: 'find-teammates',
              label: t('aiActions.findTeammates'),
              prompt: t('aiActions.findTeammatesPrompt'),
              icon: <Users className="h-4 w-4" />,
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
          ] as ContextAction[]
        }
        initialMessage={t('aiWelcome')}
      />
    </div>
  );
}
