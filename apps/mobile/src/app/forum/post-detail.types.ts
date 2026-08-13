// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryDto {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  color: string;
  postCount: number;
}

export interface PostAuthor {
  id: string;
  name?: string;
  avatar?: string;
  isVerified?: boolean;
  email?: string;
  profile?: {
    nickname?: string;
    avatarUrl?: string;
  };
}

export interface CommentDto {
  id: string;
  postId: string;
  author: PostAuthor;
  content: string;
  parentId: string | null;
  children?: CommentDto[];
  createdAt: string;
}

export interface PostDto {
  id: string;
  categoryId: string;
  category: CategoryDto;
  author: PostAuthor;
  title: string;
  content: string;
  tags: string[];
  isTeamPost: boolean;
  teamSize: number | null;
  currentSize: number | null;
  requirements: string | null;
  teamDeadline: string | null;
  teamStatus: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isLocked: boolean;
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
  comments: CommentDto[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const fmtDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const timeAgo = (dateStr: string): string => {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
};

export const getAuthorName = (author: PostAuthor): string => {
  return author.name || author.profile?.nickname || author.email?.split('@')[0] || 'User';
};
