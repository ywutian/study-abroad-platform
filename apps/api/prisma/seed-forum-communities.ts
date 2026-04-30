/**
 * Seed official forum communities and backfill legacy posts from their tags.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OFFICIAL_COMMUNITIES = [
  'Personal Statement',
  'Personal Essay',
  'AC List',
  'SAT',
  'John Locke',
  'Debate',
  'MUN',
  'Competition',
  'School News',
  'Campus Life',
  'General',
];

function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'general';
}

async function upsertCommunity(name: string, isOfficial = false) {
  const slug = slugify(name);
  return prisma.forumCommunity.upsert({
    where: { slug },
    update: {
      name,
      isOfficial: isOfficial || undefined,
      isActive: true,
    },
    create: {
      slug,
      name,
      isOfficial,
      isActive: true,
    },
  });
}

async function refreshCommunityCounts() {
  await prisma.forumCommunity.updateMany({ data: { postCount: 0 } });

  const postCounts = await prisma.forumPost.groupBy({
    by: ['communityId'],
    where: { communityId: { not: null } },
    _count: { _all: true },
  });

  for (const row of postCounts) {
    if (!row.communityId) continue;
    await prisma.forumCommunity.update({
      where: { id: row.communityId },
      data: { postCount: row._count._all },
    });
  }

  const followerCounts = await prisma.forumCommunityFollow.groupBy({
    by: ['communityId'],
    _count: { _all: true },
  });

  await prisma.forumCommunity.updateMany({ data: { followerCount: 0 } });
  for (const row of followerCounts) {
    await prisma.forumCommunity.update({
      where: { id: row.communityId },
      data: { followerCount: row._count._all },
    });
  }
}

async function main() {
  console.log('🌱 Seeding forum communities...');

  const officialBySlug = new Map<string, string>();
  for (const name of OFFICIAL_COMMUNITIES) {
    const community = await upsertCommunity(name, true);
    officialBySlug.set(community.slug, community.id);
    console.log(`  ✓ ${community.name}`);
  }

  const generalId = officialBySlug.get('general');
  if (!generalId) throw new Error('General community was not created');

  const posts = await prisma.forumPost.findMany({
    select: { id: true, tags: true, communityId: true },
  });

  const communityIdBySlug = new Map(officialBySlug);

  for (const post of posts) {
    if (post.communityId) continue;

    const primaryTag = post.tags.find((tag) => tag.trim().length > 0);
    const communityName = primaryTag || 'General';
    const slug = slugify(communityName);

    let communityId = communityIdBySlug.get(slug);
    if (!communityId) {
      const community = await upsertCommunity(communityName, false);
      communityId = community.id;
      communityIdBySlug.set(slug, community.id);
    }

    await prisma.forumPost.update({
      where: { id: post.id },
      data: { communityId: communityId || generalId },
    });
  }

  await refreshCommunityCounts();
  console.log(`✅ Forum communities seeded. Backfilled ${posts.length} posts.`);
}

main()
  .catch((error) => {
    console.error('❌ Failed to seed forum communities:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
