import {
  MessageSquare,
  Trophy,
  Sparkles,
  BookOpen,
  HelpCircle,
  FolderOpen,
  Globe,
  FileText,
  Home,
} from 'lucide-react';
import { createElement } from 'react';
import DOMPurify from 'isomorphic-dompurify';

// Types
export interface Category {
  id: string;
  name: string;
  nameZh: string;
  description?: string;
  descriptionZh?: string;
  color?: string;
  icon?: string;
  postCount: number;
}

export interface Author {
  id: string;
  name?: string;
  avatar?: string;
  isVerified: boolean;
}

export interface Post {
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

export interface Comment {
  id: string;
  content: string;
  author: Author;
  createdAt: string;
  parentId?: string;
  likeCount: number;
  replies?: Comment[];
}

export interface TeamApplication {
  id: string;
  applicant: Author;
  message?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface PostDetailResponse extends Post {
  comments: Comment[];
  teamMembers?: { id: string; user: Author; role: string; joinedAt: string }[];
  teamApplications?: TeamApplication[];
}

// Helper functions
export const getCategoryIcon = (category: Category): React.ReactNode => {
  const nameLC = (category.name || category.nameZh || '').toLowerCase();
  if (nameLC.includes('team') || nameLC.includes('组队'))
    return createElement(Trophy, { className: 'h-4 w-4' });
  if (nameLC.includes('activity') || nameLC.includes('活动'))
    return createElement(Sparkles, { className: 'h-4 w-4' });
  if (nameLC.includes('experience') || nameLC.includes('经验'))
    return createElement(BookOpen, { className: 'h-4 w-4' });
  if (nameLC.includes('question') || nameLC.includes('问答') || nameLC.includes('q&a'))
    return createElement(HelpCircle, { className: 'h-4 w-4' });
  if (nameLC.includes('resource') || nameLC.includes('资源'))
    return createElement(FolderOpen, { className: 'h-4 w-4' });
  if (nameLC.includes('life') || nameLC.includes('生活'))
    return createElement(Globe, { className: 'h-4 w-4' });
  if (nameLC.includes('essay') || nameLC.includes('文书'))
    return createElement(FileText, { className: 'h-4 w-4' });
  if (nameLC.includes('school') || nameLC.includes('选校'))
    return createElement(Home, { className: 'h-4 w-4' });
  return createElement(MessageSquare, { className: 'h-4 w-4' });
};

export const getCategoryColorStyle = (
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
  return { className: 'bg-gray-500 dark:bg-gray-600' };
};

export const stripMarkdown = (content: string): string => {
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

export const renderMarkdown = (content: string): React.ReactNode => {
  const sanitize = (html: string): string => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['strong', 'em', 'a', 'code'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  };

  const lines = content.split('\n');
  return lines.map((line, i) => {
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (line.startsWith('# ')) {
      return createElement(
        'h2',
        { key: i, className: 'text-xl font-bold mt-4 mb-2' },
        line.slice(2)
      );
    }
    if (line.startsWith('## ')) {
      return createElement(
        'h3',
        { key: i, className: 'text-lg font-semibold mt-3 mb-2' },
        line.slice(3)
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return createElement('li', {
        key: i,
        className: 'ml-4 list-disc',
        dangerouslySetInnerHTML: { __html: sanitize(line.slice(2)) },
      });
    }
    if (/^\d+\.\s/.test(line)) {
      return createElement('li', {
        key: i,
        className: 'ml-4 list-decimal',
        dangerouslySetInnerHTML: { __html: sanitize(line.replace(/^\d+\.\s/, '')) },
      });
    }
    if (!line.trim()) {
      return createElement('br', { key: i });
    }
    return createElement('p', {
      key: i,
      className: 'mb-1',
      dangerouslySetInnerHTML: { __html: sanitize(line) },
    });
  });
};
