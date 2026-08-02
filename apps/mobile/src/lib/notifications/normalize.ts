export function normalizeVisibleNotifications<T extends { type: string; content: string }>(
  items: T[]
): T[] {
  return items
    .filter((item) => item.type !== 'POINTS_EARNED' && item.type !== 'LEVEL_UP')
    .map((item) => ({
      ...item,
      // Redis history can retain pre-retirement copy for up to 30 days.
      content: item.content
        .replace(/，获得 \+\d+ 积分/g, '')
        .replace(/可获得 \+\d+ 积分/g, '可以获得更准确的分析和预测'),
    }));
}
