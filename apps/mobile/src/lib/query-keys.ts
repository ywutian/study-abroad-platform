/**
 * Centralized query key factory for React Query.
 * Ensures consistent cache keys across the app.
 */

export const queryKeys = {
  cases: {
    all: ['cases'] as const,
    list: (filters: Record<string, unknown>) => ['cases', 'list', filters] as const,
    detail: (id: string) => ['cases', 'detail', id] as const,
    bySchool: (schoolId: string) => ['cases', 'bySchool', schoolId] as const,
    recent: ['cases', 'recent'] as const,
  },
  schools: {
    all: ['schools'] as const,
    list: (filters: Record<string, unknown>) => ['schools', 'list', filters] as const,
    detail: (id: string) => ['schools', 'detail', id] as const,
    top: ['schools', 'top'] as const,
  },
  profile: {
    me: ['profile'] as const,
  },
  conversations: {
    all: ['conversations'] as const,
    detail: (id: string) => ['conversation', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unread: ['notifications', 'unread'] as const,
  },
  timelines: {
    all: ['timelines'] as const,
    overview: ['timelines', 'overview'] as const,
    globalEvents: ['timelines', 'globalEvents'] as const,
  },
  forum: {
    posts: (filters: Record<string, unknown>) => ['forum', 'posts', filters] as const,
    detail: (id: string) => ['forum', 'post', id] as const,
    stats: ['forum', 'stats'] as const,
  },
  swipe: {
    nextCase: ['swipe', 'next'] as const,
    stats: ['swipe', 'stats'] as const,
  },
} as const;
