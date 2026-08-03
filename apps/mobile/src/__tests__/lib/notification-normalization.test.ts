import { normalizeVisibleNotifications } from '@/lib/notifications/normalize';

const base = {
  id: 'n1',
  type: 'SYSTEM_BROADCAST',
  title: 'title',
  content: 'content',
  userId: 'u1',
  read: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('notification normalization after points retirement', () => {
  it('hides legacy point and level events', () => {
    const result = normalizeVisibleNotifications([
      { ...base, type: 'POINTS_EARNED' },
      { ...base, id: 'n2', type: 'LEVEL_UP' },
    ]);
    expect(result).toEqual([]);
  });

  it('removes stale point rewards from retained notification copy', () => {
    const [result] = normalizeVisibleNotifications([
      { ...base, type: 'CASE_HELPFUL', content: '你的案例被标记为有帮助，获得 +10 积分' },
    ]);
    expect(result.content).toBe('你的案例被标记为有帮助');
  });
});
