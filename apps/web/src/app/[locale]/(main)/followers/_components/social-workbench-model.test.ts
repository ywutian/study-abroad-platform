import { describe, expect, it } from 'vitest';
import type { SocialRelationItem } from '@study-abroad/shared';
import {
  canStartConversation,
  getAvailableBulkActions,
  getSocialAvatarInitial,
  getSocialDisplayName,
  toggleSelectedId,
} from './social-workbench-model';

const baseItem: SocialRelationItem = {
  relationId: 'relation-1',
  relationType: 'followers',
  createdAt: '2026-05-15T08:00:00.000Z',
  relationship: 'mutual',
  user: {
    id: 'user-1',
    email: 'demo@example.com',
    role: 'VERIFIED',
    profile: { nickname: 'Demo Student' },
    stats: { followers: 3, following: 2, cases: 1 },
  },
};

describe('social-workbench-model', () => {
  it('returns bulk actions by active tab', () => {
    expect(getAvailableBulkActions('followers')).toEqual(['follow', 'block']);
    expect(getAvailableBulkActions('following')).toEqual(['unfollow', 'block']);
    expect(getAvailableBulkActions('blocked')).toEqual(['unblock']);
  });

  it('only allows conversations for mutual non-blocked relationships', () => {
    expect(canStartConversation(baseItem)).toBe(true);
    expect(canStartConversation({ ...baseItem, relationship: 'oneWay' })).toBe(false);
    expect(
      canStartConversation({
        ...baseItem,
        relationType: 'blocked',
        relationship: 'blocked',
      })
    ).toBe(false);
  });

  it('derives display names and initials from profile first', () => {
    expect(getSocialDisplayName(baseItem)).toBe('Demo Student');
    expect(getSocialAvatarInitial(baseItem)).toBe('D');
    expect(
      getSocialDisplayName({
        ...baseItem,
        user: { ...baseItem.user, profile: null },
      })
    ).toBe('demo');
  });

  it('toggles selected ids without duplicating entries', () => {
    expect(toggleSelectedId([], 'user-1', true)).toEqual(['user-1']);
    expect(toggleSelectedId(['user-1'], 'user-1', true)).toEqual(['user-1']);
    expect(toggleSelectedId(['user-1', 'user-2'], 'user-1', false)).toEqual(['user-2']);
  });
});
