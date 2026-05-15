import type {
  SocialBulkAction,
  SocialRelationItem,
  SocialRelationType,
} from '@study-abroad/shared';

export const SOCIAL_RELATION_PAGE_SIZE = 20;

export function getAvailableBulkActions(tab: SocialRelationType): SocialBulkAction[] {
  if (tab === 'followers') return ['follow', 'block'];
  if (tab === 'following') return ['unfollow', 'block'];
  return ['unblock'];
}

export function canStartConversation(item: SocialRelationItem): boolean {
  return item.relationship === 'mutual' && item.relationType !== 'blocked';
}

export function getSocialDisplayName(item: Pick<SocialRelationItem, 'user'>): string {
  return item.user.profile?.nickname || item.user.email.split('@')[0] || item.user.email;
}

export function getSocialAvatarInitial(item: Pick<SocialRelationItem, 'user'>): string {
  return getSocialDisplayName(item).slice(0, 1).toUpperCase() || '?';
}

export function toggleSelectedId(selectedIds: string[], userId: string, checked: boolean) {
  const next = new Set(selectedIds);
  if (checked) {
    next.add(userId);
  } else {
    next.delete(userId);
  }
  return Array.from(next);
}
