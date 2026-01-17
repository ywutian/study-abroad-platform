// 论坛类型定义 - 与后端 DTO 对齐

export interface Author {
  id: string;
  name?: string;
  avatar?: string;
  isVerified: boolean;
}

export interface Category {
  id: string;
  name: string;
  nameZh: string;
  description?: string;
  descriptionZh?: string;
  icon?: string;
  color?: string;
  postCount: number;
}

export interface Post {
  id: string;
  categoryId: string;
  category?: Category;
  author: Author;
  title: string;
  content: string;
  tags: string[];
  postTag?: ForumPostTag;
  isTeamPost: boolean;
  teamSize?: number;
  currentSize?: number;
  requirements?: string;
  teamDeadline?: string;
  teamStatus?: TeamStatus;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isLocked: boolean;
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  author: Author;
  content: string;
  parentId?: string;
  likeCount: number;
  replies?: Comment[];
  createdAt: string;
}

export interface TeamMember {
  id: string;
  user: Author;
  role: string;
  joinedAt: string;
}

export interface TeamApplication {
  id: string;
  applicant: Author;
  message?: string;
  status: TeamAppStatus;
  createdAt: string;
}

export interface PostDetail extends Post {
  comments: Comment[];
  teamMembers?: TeamMember[];
  teamApplications?: TeamApplication[];
}

export interface PostListResponse {
  posts: Post[];
  total: number;
  hasMore: boolean;
}

// 枚举类型
export type PostSortBy = 'latest' | 'popular' | 'comments' | 'recommended';

export type ForumPostTag = 'COMPETITION' | 'ACTIVITY' | 'QUESTION' | 'SHARING' | 'OTHER';

export type TeamStatus = 'RECRUITING' | 'FULL' | 'CLOSED';

export type TeamAppStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'false_info' | 'other';

// 标签配置
export const TAG_CONFIG: Record<
  ForumPostTag,
  { label: string; labelZh: string; icon: string; color: string }
> = {
  COMPETITION: { label: 'Competition', labelZh: '竞赛', icon: '🏆', color: 'warning' },
  ACTIVITY: { label: 'Activity', labelZh: '活动', icon: '🎯', color: 'info' },
  QUESTION: { label: 'Question', labelZh: '提问', icon: '❓', color: 'purple' },
  SHARING: { label: 'Sharing', labelZh: '分享', icon: '📝', color: 'success' },
  OTHER: { label: 'Other', labelZh: '其他', icon: '📌', color: 'secondary' },
};

// 排序配置
export const SORT_CONFIG: Record<PostSortBy, { label: string; labelZh: string; icon: string }> = {
  latest: { label: 'Latest', labelZh: '最新', icon: 'Clock' },
  popular: { label: 'Popular', labelZh: '最热', icon: 'Flame' },
  comments: { label: 'Most Comments', labelZh: '最多评论', icon: 'MessageCircle' },
  recommended: { label: 'Recommended', labelZh: '推荐', icon: 'Sparkles' },
};

// 举报原因配置
export const REPORT_REASONS: {
  value: ReportReason;
  label: string;
  labelZh: string;
  description: string;
  descriptionZh: string;
}[] = [
  {
    value: 'spam',
    label: 'Spam/Advertising',
    labelZh: '垃圾信息/广告',
    description: 'Contains promotional or spam content',
    descriptionZh: '包含推广、广告或垃圾内容',
  },
  {
    value: 'inappropriate',
    label: 'Inappropriate Content',
    labelZh: '不当内容',
    description: 'Contains offensive or inappropriate content',
    descriptionZh: '包含攻击性或违规内容',
  },
  {
    value: 'harassment',
    label: 'Harassment/Attack',
    labelZh: '骚扰/攻击',
    description: 'Personal harassment or attack',
    descriptionZh: '针对个人的骚扰或人身攻击',
  },
  {
    value: 'false_info',
    label: 'False Information',
    labelZh: '虚假信息',
    description: 'Contains misleading or false information',
    descriptionZh: '包含误导性或虚假信息',
  },
  {
    value: 'other',
    label: 'Other',
    labelZh: '其他',
    description: 'Other violations',
    descriptionZh: '其他违规行为',
  },
];
