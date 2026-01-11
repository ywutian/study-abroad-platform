'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
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
  ChevronRight,
  Tag,
  Trophy,
  Sparkles,
  BookOpen,
  HelpCircle,
  FolderOpen,
  X,
  Send,
  MoreHorizontal,
  Edit,
  Trash2,
  Share2,
  UserPlus,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient as api } from '@/lib/api';

// API 响应类型
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string;
  _count: { posts: number };
}

interface Author {
  id: string;
  nickname: string;
  avatar: string;
  isVerified: boolean;
}

interface Post {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  category: Category;
  authorId: string;
  author: Author;
  isTeamPost: boolean;
  teamSize?: number;
  currentMembers?: number;
  deadline?: string;
  requirements?: string;
  tags: string[];
  views: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { comments: number; likes: number };
  isLiked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  authorId: string;
  author: Author;
  createdAt: string;
  parentId?: string;
  replies?: Comment[];
}

interface TeamApplication {
  id: string;
  postId: string;
  userId: string;
  user: Author;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  team: <Trophy className="h-4 w-4" />,
  activity: <Sparkles className="h-4 w-4" />,
  experience: <BookOpen className="h-4 w-4" />,
  question: <HelpCircle className="h-4 w-4" />,
  resource: <FolderOpen className="h-4 w-4" />,
};

const categoryColors: Record<string, string> = {
  team: 'from-amber-500 to-orange-600',
  activity: 'from-violet-500 to-purple-600',
  experience: 'from-emerald-500 to-green-600',
  question: 'from-blue-500 to-cyan-600',
  resource: 'from-rose-500 to-pink-600',
};

export default function ForumPage() {
  const t = useTranslations('forum');

  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'comments'>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTeamOnly, setShowTeamOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPostDetail, setShowPostDetail] = useState<Post | null>(null);
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

  // Post detail states
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [applications, setApplications] = useState<TeamApplication[]>([]);
  const [applicationMessage, setApplicationMessage] = useState('');

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get<ApiResponse<Category[]>>('/forum/categories');
        if (res.success) {
          setCategories(res.data);
        }
      } catch (error) {
        // Use default categories if API fails
        setCategories([
          { id: '1', name: t('categoryTeam'), slug: 'team', description: '', color: '#f59e0b', icon: 'trophy', _count: { posts: 0 } },
          { id: '2', name: t('categoryActivity'), slug: 'activity', description: '', color: '#8b5cf6', icon: 'sparkles', _count: { posts: 0 } },
          { id: '3', name: t('categoryExperience'), slug: 'experience', description: '', color: '#10b981', icon: 'book', _count: { posts: 0 } },
          { id: '4', name: t('categoryQuestion'), slug: 'question', description: '', color: '#3b82f6', icon: 'help', _count: { posts: 0 } },
          { id: '5', name: t('categoryResource'), slug: 'resource', description: '', color: '#f43f5e', icon: 'folder', _count: { posts: 0 } },
        ]);
      }
    };
    fetchCategories();
  }, [t]);

  // Fetch posts
  const fetchPosts = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: reset ? '1' : String(page),
        limit: '10',
        sort: sortBy,
      });
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      if (showTeamOnly) params.append('isTeamPost', 'true');

      const res = await api.get<ApiResponse<{ posts: Post[]; total: number }>>(`/forum/posts?${params.toString()}`);
      if (res.success) {
        const newPosts = res.data.posts;
        setPosts(reset ? newPosts : [...posts, ...newPosts]);
        setHasMore(newPosts.length === 10);
        if (reset) setPage(1);
      }
    } catch (error) {
      // Demo data if API fails
      const demoPosts: Post[] = [
        {
          id: '1',
          title: '【组队】2026 MCM/ICM 数学建模竞赛组队',
          content: '寻找队友参加2026年美国数学建模竞赛，需要编程能力强的同学...',
          categoryId: '1',
          category: { id: '1', name: t('categoryTeam'), slug: 'team', description: '', color: '#f59e0b', icon: 'trophy', _count: { posts: 12 } },
          authorId: '1',
          author: { id: '1', nickname: 'Alex Chen', avatar: '', isVerified: true },
          isTeamPost: true,
          teamSize: 3,
          currentMembers: 1,
          deadline: '2026-02-15',
          requirements: '编程能力强，熟悉Python/MATLAB',
          tags: ['数学建模', 'MCM', '竞赛'],
          views: 234,
          isPinned: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { comments: 8, likes: 23 },
          isLiked: false,
        },
        {
          id: '2',
          title: '分享：我是如何拿到MIT EECS录取的',
          content: '从高一开始准备，三年的努力终于有了回报。分享一下我的申请经验...',
          categoryId: '3',
          category: { id: '3', name: t('categoryExperience'), slug: 'experience', description: '', color: '#10b981', icon: 'book', _count: { posts: 45 } },
          authorId: '2',
          author: { id: '2', nickname: 'Emily Wang', avatar: '', isVerified: true },
          isTeamPost: false,
          tags: ['MIT', 'EECS', '申请经验'],
          views: 1520,
          isPinned: false,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          _count: { comments: 56, likes: 189 },
          isLiked: true,
        },
        {
          id: '3',
          title: '请问：文书PS和SOP有什么区别？',
          content: '最近在准备文书，但是不太理解Personal Statement和Statement of Purpose的区别...',
          categoryId: '4',
          category: { id: '4', name: t('categoryQuestion'), slug: 'question', description: '', color: '#3b82f6', icon: 'help', _count: { posts: 78 } },
          authorId: '3',
          author: { id: '3', nickname: 'Kevin Liu', avatar: '', isVerified: false },
          isTeamPost: false,
          tags: ['文书', 'PS', 'SOP'],
          views: 89,
          isPinned: false,
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          updatedAt: new Date(Date.now() - 7200000).toISOString(),
          _count: { comments: 12, likes: 15 },
          isLiked: false,
        },
      ];
      setPosts(demoPosts);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, selectedCategory, searchQuery, showTeamOnly, posts, t]);

  useEffect(() => {
    fetchPosts(true);
  }, [sortBy, selectedCategory, showTeamOnly]);

  // Create post
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
        payload.deadline = formDeadline;
        payload.requirements = formRequirements;
      }

      const res = await api.post<ApiResponse<Post>>('/forum/posts', payload);
      if (res.success) {
        setShowCreateDialog(false);
        resetForm();
        fetchPosts(true);
      }
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setSubmitting(false);
    }
  };

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
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && formTagInput.trim()) {
      e.preventDefault();
      if (!formTags.includes(formTagInput.trim())) {
        setFormTags([...formTags, formTagInput.trim()]);
      }
      setFormTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormTags(formTags.filter(t => t !== tag));
  };

  // Like post
  const handleLike = async (postId: string) => {
    try {
      const res = await api.post<ApiResponse<{ liked: boolean }>>(`/forum/posts/${postId}/like`);
      if (res.success) {
        setPosts(posts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              isLiked: !p.isLiked,
              _count: {
                ...p._count,
                likes: p.isLiked ? p._count.likes - 1 : p._count.likes + 1,
              },
            };
          }
          return p;
        }));
      }
    } catch (error) {
      // Toggle optimistically for demo
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            isLiked: !p.isLiked,
            _count: {
              ...p._count,
              likes: p.isLiked ? p._count.likes - 1 : p._count.likes + 1,
            },
          };
        }
        return p;
      }));
    }
  };

  // View post detail
  const viewPostDetail = async (post: Post) => {
    setShowPostDetail(post);
    setLoadingComments(true);
    try {
      const res = await api.get<ApiResponse<Comment[]>>(`/forum/posts/${post.id}/comments`);
      if (res.success) {
        setComments(res.data);
      }
    } catch (error) {
      // Demo comments
      setComments([
        {
          id: '1',
          content: '非常详细的分享！请问你的GPA是多少？',
          authorId: '3',
          author: { id: '3', nickname: 'Kevin Liu', avatar: '', isVerified: false },
          createdAt: new Date(Date.now() - 1800000).toISOString(),
          replies: [
            {
              id: '2',
              content: '我的GPA是3.95，不过我觉得课外活动和文书更重要',
              authorId: '2',
              author: { id: '2', nickname: 'Emily Wang', avatar: '', isVerified: true },
              parentId: '1',
              createdAt: new Date(Date.now() - 900000).toISOString(),
            },
          ],
        },
      ]);
    } finally {
      setLoadingComments(false);
    }
  };

  // Post comment
  const handlePostComment = async () => {
    if (!commentContent.trim() || !showPostDetail) return;
    try {
      const res = await api.post<ApiResponse<Comment>>(`/forum/posts/${showPostDetail.id}/comments`, {
        content: commentContent,
      });
      if (res.success) {
        setComments([res.data, ...comments]);
        setCommentContent('');
      }
    } catch (error) {
      // Optimistic add for demo
      const newComment: Comment = {
        id: String(Date.now()),
        content: commentContent,
        authorId: 'me',
        author: { id: 'me', nickname: 'Me', avatar: '', isVerified: false },
        createdAt: new Date().toISOString(),
      };
      setComments([newComment, ...comments]);
      setCommentContent('');
    }
  };

  // Team application
  const handleApply = async (postId: string) => {
    if (!applicationMessage.trim()) return;
    try {
      await api.post(`/forum/posts/${postId}/apply`, {
        message: applicationMessage,
      });
      setApplicationMessage('');
      // Update UI
    } catch (error) {
      console.error('Failed to apply:', error);
    }
  };

  // Load applications (for team owner)
  const loadApplications = async (postId: string) => {
    setShowApplications(postId);
    try {
      const res = await api.get<ApiResponse<TeamApplication[]>>(`/forum/posts/${postId}/applications`);
      if (res.success) {
        setApplications(res.data);
      }
    } catch (error) {
      // Demo data
      setApplications([
        {
          id: '1',
          postId,
          userId: '4',
          user: { id: '4', nickname: 'Sarah Johnson', avatar: '', isVerified: true },
          message: '我对数学建模很有热情，Python和MATLAB都很熟练',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  // Handle application
  const handleApplication = async (appId: string, action: 'accept' | 'reject') => {
    try {
      await api.patch(`/forum/applications/${appId}`, { action });
      setApplications(applications.map(a => 
        a.id === appId ? { ...a, status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' } : a
      ));
    } catch (error) {
      // Optimistic update
      setApplications(applications.map(a => 
        a.id === appId ? { ...a, status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' } : a
      ));
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-violet-50/30">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-4">
              <MessageSquare className="h-5 w-5 text-white" />
              <span className="text-white font-medium">{t('title')}</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">{t('description')}</h1>
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-white text-purple-600 hover:bg-white/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('createPost')}
              </Button>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => {
                  setIsTeamPost(true);
                  setShowCreateDialog(true);
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                {t('createTeam')}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Categories */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5 text-purple-500" />
                  {t('categories')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={selectedCategory === null ? 'default' : 'ghost'}
                  className={`w-full justify-start ${selectedCategory === null ? 'bg-gradient-to-r from-purple-500 to-pink-500' : ''}`}
                  onClick={() => setSelectedCategory(null)}
                >
                  {t('allPosts')}
                </Button>
                <Button
                  variant={showTeamOnly ? 'default' : 'ghost'}
                  className={`w-full justify-start ${showTeamOnly ? 'bg-gradient-to-r from-amber-500 to-orange-500' : ''}`}
                  onClick={() => setShowTeamOnly(!showTeamOnly)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  {t('teamPosts')}
                </Button>
                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-2" />
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? 'default' : 'ghost'}
                    className={`w-full justify-between ${
                      selectedCategory === category.id 
                        ? `bg-gradient-to-r ${categoryColors[category.slug] || 'from-gray-500 to-gray-600'}` 
                        : ''
                    }`}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <span className="flex items-center gap-2">
                      {categoryIcons[category.slug]}
                      {category.name}
                    </span>
                    <Badge variant="secondary" className="bg-white/20">
                      {category._count.posts}
                    </Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="bg-gradient-to-br from-purple-500 to-pink-500 border-0 shadow-lg text-white">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold">1.2K</div>
                    <div className="text-white/80 text-sm">帖子</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">856</div>
                    <div className="text-white/80 text-sm">用户</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">45</div>
                    <div className="text-white/80 text-sm">组队中</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">128</div>
                    <div className="text-white/80 text-sm">今日活跃</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search & Sort */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={t('search')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchPosts(true)}
                      className="pl-10 bg-gray-50 border-0"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={sortBy === 'latest' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortBy('latest')}
                      className={sortBy === 'latest' ? 'bg-purple-500' : ''}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      {t('latest')}
                    </Button>
                    <Button
                      variant={sortBy === 'popular' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortBy('popular')}
                      className={sortBy === 'popular' ? 'bg-purple-500' : ''}
                    >
                      <Flame className="h-4 w-4 mr-1" />
                      {t('popular')}
                    </Button>
                    <Button
                      variant={sortBy === 'comments' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortBy('comments')}
                      className={sortBy === 'comments' ? 'bg-purple-500' : ''}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      {t('mostComments')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Posts List */}
            <AnimatePresence mode="popLayout">
              {loading && posts.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : posts.length === 0 ? (
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-500">{t('noPosts')}</h3>
                    <p className="text-gray-400 mt-1">{t('noPostsDesc')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {posts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className={`bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group ${
                          post.isPinned ? 'ring-2 ring-amber-400' : ''
                        }`}
                        onClick={() => viewPostDetail(post)}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-12 w-12 ring-2 ring-purple-100">
                              <AvatarImage src={post.author.avatar} />
                              <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-white">
                                {post.author.nickname.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {post.isPinned && (
                                  <Badge className="bg-amber-100 text-amber-700 text-xs">置顶</Badge>
                                )}
                                {post.isTeamPost && (
                                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs">
                                    <Users className="h-3 w-3 mr-1" />
                                    组队 {post.currentMembers}/{post.teamSize}
                                  </Badge>
                                )}
                                <Badge 
                                  className={`bg-gradient-to-r ${categoryColors[post.category.slug] || 'from-gray-500 to-gray-600'} text-white text-xs`}
                                >
                                  {categoryIcons[post.category.slug]}
                                  <span className="ml-1">{post.category.name}</span>
                                </Badge>
                              </div>
                              <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-1">
                                {post.title}
                              </h3>
                              <p className="text-gray-600 text-sm mt-1 line-clamp-2">{post.content}</p>
                              <div className="flex items-center gap-4 mt-3">
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                  <span className="font-medium text-gray-700">{post.author.nickname}</span>
                                  {post.author.isVerified && (
                                    <CheckCircle className="h-4 w-4 text-blue-500" />
                                  )}
                                </div>
                                <span className="text-xs text-gray-400">{formatDate(post.createdAt)}</span>
                                <div className="flex-1" />
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Eye className="h-4 w-4" />
                                    {post.views}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageCircle className="h-4 w-4" />
                                    {post._count.comments}
                                  </span>
                                  <button 
                                    className={`flex items-center gap-1 transition-colors ${post.isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
                                    onClick={(e) => { e.stopPropagation(); handleLike(post.id); }}
                                  >
                                    <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
                                    {post._count.likes}
                                  </button>
                                </div>
                              </div>
                              {post.tags.length > 0 && (
                                <div className="flex items-center gap-2 mt-3">
                                  {post.tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs text-purple-600 border-purple-200">
                                      <Tag className="h-3 w-3 mr-1" />
                                      {tag}
                                    </Badge>
                                  ))}
                                  {post.tags.length > 3 && (
                                    <span className="text-xs text-gray-400">+{post.tags.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
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
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => { setPage(p => p + 1); fetchPosts(); }}
                  disabled={loading}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isTeamPost ? (
                <>
                  <Users className="h-5 w-5 text-amber-500" />
                  {t('createTeam')}
                </>
              ) : (
                <>
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  {t('createPost')}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Button
                variant={!isTeamPost ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsTeamPost(false)}
                className={!isTeamPost ? 'bg-purple-500' : ''}
              >
                普通帖子
              </Button>
              <Button
                variant={isTeamPost ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsTeamPost(true)}
                className={isTeamPost ? 'bg-amber-500' : ''}
              >
                <Users className="h-4 w-4 mr-1" />
                组队帖子
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">{t('title_label')}</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="请输入标题..."
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">{t('category_label')}</label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        {categoryIcons[cat.slug]}
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">{t('content_label')}</label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="请输入内容..."
                className="mt-1 min-h-[150px]"
              />
            </div>

            {isTeamPost && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">{t('teamSize')}</label>
                    <Input
                      type="number"
                      value={formTeamSize}
                      onChange={(e) => setFormTeamSize(Number(e.target.value))}
                      min={2}
                      max={20}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">{t('deadline')}</label>
                    <Input
                      type="date"
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('requirements')}</label>
                  <Textarea
                    value={formRequirements}
                    onChange={(e) => setFormRequirements(e.target.value)}
                    placeholder="描述队友要求..."
                    className="mt-1"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">{t('tags_label')}</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {formTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-1">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                value={formTagInput}
                onChange={(e) => setFormTagInput(e.target.value)}
                onKeyDown={handleTagInput}
                placeholder={t('tagsPlaceholder')}
                className="mt-2"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreatePost}
                disabled={submitting || !formTitle.trim() || !formContent.trim() || !formCategory}
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t('submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Detail Dialog */}
      <Dialog open={!!showPostDetail} onOpenChange={() => setShowPostDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {showPostDetail && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  {showPostDetail.isTeamPost && (
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                      <Users className="h-3 w-3 mr-1" />
                      组队 {showPostDetail.currentMembers}/{showPostDetail.teamSize}
                    </Badge>
                  )}
                  <Badge className={`bg-gradient-to-r ${categoryColors[showPostDetail.category.slug] || 'from-gray-500 to-gray-600'} text-white`}>
                    {showPostDetail.category.name}
                  </Badge>
                </div>
                <DialogTitle className="text-xl">{showPostDetail.title}</DialogTitle>
                <div className="flex items-center gap-3 mt-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={showPostDetail.author.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-white text-sm">
                      {showPostDetail.author.nickname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{showPostDetail.author.nickname}</span>
                    {showPostDetail.author.isVerified && <CheckCircle className="h-4 w-4 text-blue-500" />}
                  </div>
                  <span className="text-sm text-gray-400">{formatDate(showPostDetail.createdAt)}</span>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap text-gray-700">{showPostDetail.content}</p>
                </div>

                {showPostDetail.isTeamPost && (
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-amber-800 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        组队信息
                      </h4>
                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-gray-500">团队人数:</span>
                          <span className="ml-2 font-medium">{showPostDetail.currentMembers}/{showPostDetail.teamSize}</span>
                        </div>
                        {showPostDetail.deadline && (
                          <div>
                            <span className="text-gray-500">截止日期:</span>
                            <span className="ml-2 font-medium">{new Date(showPostDetail.deadline).toLocaleDateString()}</span>
                          </div>
                        )}
                        {showPostDetail.requirements && (
                          <div className="col-span-2">
                            <span className="text-gray-500">队友要求:</span>
                            <p className="mt-1 text-gray-700">{showPostDetail.requirements}</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <div className="flex-1">
                          <Input
                            value={applicationMessage}
                            onChange={(e) => setApplicationMessage(e.target.value)}
                            placeholder={t('applicationPlaceholder')}
                          />
                        </div>
                        <Button 
                          onClick={() => handleApply(showPostDetail.id)}
                          className="bg-amber-500 hover:bg-amber-600"
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          {t('apply')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {showPostDetail.tags.length > 0 && (
                  <div className="flex items-center gap-2">
                    {showPostDetail.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-purple-600 border-purple-200">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 py-3 border-t border-b">
                  <button 
                    className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
                      showPostDetail.isLiked ? 'bg-red-100 text-red-500' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => handleLike(showPostDetail.id)}
                  >
                    <Heart className={`h-5 w-5 ${showPostDetail.isLiked ? 'fill-current' : ''}`} />
                    <span>{showPostDetail._count.likes} {t('likes')}</span>
                  </button>
                  <div className="flex items-center gap-1 text-gray-500">
                    <Eye className="h-5 w-5" />
                    <span>{showPostDetail.views} {t('views')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <MessageCircle className="h-5 w-5" />
                    <span>{showPostDetail._count.comments} {t('comments')}</span>
                  </div>
                </div>

                {/* Comments */}
                <div>
                  <h4 className="font-medium mb-4">{t('comments')} ({showPostDetail._count.comments})</h4>
                  
                  <div className="flex gap-3 mb-6">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-purple-100 text-purple-600">Me</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        placeholder={t('writeComment')}
                        onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                      />
                      <Button onClick={handlePostComment} size="icon" className="bg-purple-500">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {loadingComments ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="space-y-3">
                          <div className="flex gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={comment.author.avatar} />
                              <AvatarFallback className="bg-gray-100 text-gray-600 text-sm">
                                {comment.author.nickname.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{comment.author.nickname}</span>
                                {comment.author.isVerified && <CheckCircle className="h-3 w-3 text-blue-500" />}
                                <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                              </div>
                              <p className="text-gray-700 text-sm mt-1">{comment.content}</p>
                            </div>
                          </div>
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="ml-11 space-y-3">
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="flex gap-3">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={reply.author.avatar} />
                                    <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                      {reply.author.nickname.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{reply.author.nickname}</span>
                                      {reply.author.isVerified && <CheckCircle className="h-3 w-3 text-blue-500" />}
                                      <span className="text-xs text-gray-400">{formatDate(reply.createdAt)}</span>
                                    </div>
                                    <p className="text-gray-700 text-sm mt-1">{reply.content}</p>
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
              {t('reviewApplications')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {applications.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t('noApplications')}</p>
            ) : (
              applications.map((app) => (
                <Card key={app.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={app.user.avatar} />
                        <AvatarFallback className="bg-purple-100 text-purple-600">
                          {app.user.nickname.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{app.user.nickname}</span>
                          {app.user.isVerified && <CheckCircle className="h-4 w-4 text-blue-500" />}
                          <Badge variant={
                            app.status === 'ACCEPTED' ? 'default' :
                            app.status === 'REJECTED' ? 'destructive' : 'secondary'
                          }>
                            {app.status === 'ACCEPTED' ? '已接受' :
                             app.status === 'REJECTED' ? '已拒绝' : '待处理'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{app.message}</p>
                        <div className="text-xs text-gray-400 mt-1">{formatDate(app.createdAt)}</div>
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
    </div>
  );
}

