import { expect, test } from '@playwright/test';

const category = {
  id: 'forum-infinite-category',
  name: 'Application Experience',
  nameZh: '申请经验',
  postCount: 24,
};

const community = {
  id: 'forum-infinite-community',
  slug: 'apply',
  name: 'Apply',
  description: 'Application strategy, timelines, and school list feedback.',
  postCount: 24,
  followerCount: 4200,
  isOfficial: true,
  isFollowing: false,
  createdAt: new Date('2026-04-01T12:00:00Z').toISOString(),
};

const posts = Array.from({ length: 24 }, (_, index) => ({
  id: `forum-infinite-post-${index + 1}`,
  title: `Infinite scroll forum post ${index + 1}`,
  content:
    'I am comparing options and would love concrete advice from people who have recently been through the same application stage.',
  categoryId: category.id,
  category,
  communityId: community.id,
  community,
  author: {
    id: `forum-infinite-author-${index + 1}`,
    name: 'Amy',
    avatar: '',
    isVerified: false,
  },
  images: [],
  isTeamPost: false,
  tags: ['application', 'planning'],
  viewCount: 1200 + index,
  likeCount: 18 + index,
  commentCount: 4 + index,
  isPinned: index === 0,
  isLocked: false,
  createdAt: new Date(
    `2026-04-${String(10 + (index % 10)).padStart(2, '0')}T12:00:00Z`
  ).toISOString(),
  updatedAt: new Date(
    `2026-04-${String(10 + (index % 10)).padStart(2, '0')}T12:00:00Z`
  ).toISOString(),
  isLiked: false,
}));

function apiResponse(data: unknown) {
  return { success: true, data };
}

test('forum loads more posts automatically near the bottom', async ({ page }) => {
  const requestedOffsets: number[] = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api(?:\/v1)?(?=\/|$)/, '') || '/';

    if (path === '/auth/refresh') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiResponse({ accessToken: 'forum-infinite-token' })),
      });
      return;
    }

    if (path === '/forums/categories') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiResponse([category])),
      });
      return;
    }

    if (path === '/forums/communities') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiResponse([community])),
      });
      return;
    }

    if (path === '/forums/posts') {
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit') || 10);
      requestedOffsets.push(offset);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          apiResponse({
            posts: posts.slice(offset, offset + limit),
            total: posts.length,
            hasMore: offset + limit < posts.length,
          })
        ),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiResponse({})),
    });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/forum', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Infinite scroll forum post 1', { exact: true })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByText('Infinite scroll forum post 11', { exact: true })).toBeVisible({
    timeout: 10000,
  });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByText('Infinite scroll forum post 21', { exact: true })).toBeVisible({
    timeout: 10000,
  });

  expect(requestedOffsets).toEqual(expect.arrayContaining([0, 10, 20]));
});
