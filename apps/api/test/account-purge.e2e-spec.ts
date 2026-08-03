import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { AccountPurgeService } from '../src/modules/user/account-purge.service';

/**
 * The purge against a real database.
 *
 * `hardDelete` compensates for things a Postgres cascade does silently: it
 * recounts denormalised forum counters, reopens a team the deleted member was
 * holding FULL, and recomputes every peer-review counterparty's rating. None of
 * that is observable in a unit test — there the transaction client is a mock, so
 * no cascade ever runs and the assertions only prove the application code is
 * self-consistent about a deletion that did not happen.
 *
 * This suite exists because AccountPurgeService put hardDelete on the hot path.
 * Before it, the method had no caller and the counter fixes were pre-emptive;
 * now they run nightly against production rows, so the cascade interaction is
 * the thing that needs proving.
 */
describe('Account purge (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let users: UserService;
  let purge: AccountPurgeService;

  const password = 'TestPassword123!';
  const mkEmail = (tag: string) =>
    `purge-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

  /** Create a verified user straight through Prisma — no HTTP round trip needed. */
  const mkUser = async (tag: string) =>
    prisma.user.create({
      data: {
        email: mkEmail(tag),
        passwordHash: password,
        emailVerified: true,
        profile: { create: { realName: `Purge ${tag}` } },
      },
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    users = app.get(UserService);
    purge = app.get(AccountPurgeService);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('leaves the row behind on a soft delete, and removes it on a purge', async () => {
    const user = await mkUser('basic');

    await users.softDelete(user.id);
    const afterSoft = await prisma.user.findUnique({ where: { id: user.id } });
    expect(afterSoft).not.toBeNull();
    expect(afterSoft!.deletedAt).not.toBeNull();
    // the identifiers are cleared even though the row stays
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });
    expect(profile?.realName).toBeNull();

    await users.hardDelete(user.id);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(
      await prisma.profile.findUnique({ where: { userId: user.id } }),
    ).toBeNull();
  }, 30000);

  it('recounts a post comment count the cascade would have left stale', async () => {
    const author = await mkUser('author');
    const commenter = await mkUser('commenter');

    // `name` and `nameZh` are both @unique and both required.
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const category = await prisma.forumCategory.create({
      data: { name: `purge-cat-${stamp}`, nameZh: `清除测试-${stamp}` },
    });
    const post = await prisma.forumPost.create({
      data: {
        title: 'purge target',
        content: 'x',
        authorId: author.id,
        categoryId: category.id,
      },
    });
    await prisma.forumComment.create({
      data: { postId: post.id, authorId: commenter.id, content: 'a' },
    });
    await prisma.forumComment.create({
      data: { postId: post.id, authorId: author.id, content: 'b' },
    });
    await prisma.forumPost.update({
      where: { id: post.id },
      data: { commentCount: 2 },
    });

    // The cascade removes the commenter's ForumComment row and runs no
    // application code; without the recount, commentCount stays at 2 forever.
    await users.hardDelete(commenter.id);

    const after = await prisma.forumPost.findUnique({
      where: { id: post.id },
      select: { commentCount: true },
    });
    const actual = await prisma.forumComment.count({
      where: { postId: post.id },
    });
    expect(after?.commentCount).toBe(actual);
    expect(after?.commentCount).toBe(1);

    await prisma.forumPost.delete({ where: { id: post.id } }).catch(() => {});
    await prisma.forumCategory
      .delete({ where: { id: category.id } })
      .catch(() => {});
    await users.hardDelete(author.id).catch(() => {});
  }, 30000);

  it('honours the grace window and the dry-run switch', async () => {
    const fresh = await mkUser('fresh');
    const stale = await mkUser('stale');

    await users.softDelete(fresh.id);
    await users.softDelete(stale.id);
    // Age one of them past any plausible grace window.
    await prisma.user.update({
      where: { id: stale.id },
      data: { deletedAt: new Date('2020-01-01') },
    });

    // ACCOUNT_PURGE_ENABLED is unset in the e2e env, so this is the dry run:
    // it must report the stale account and delete nothing.
    const report = await purge.purgeExpired();
    expect(report.dryRun).toBe(true);
    expect(report.eligible).toBeGreaterThanOrEqual(1);
    expect(report.purged).toBe(0);
    expect(
      await prisma.user.findUnique({ where: { id: stale.id } }),
    ).not.toBeNull();

    // The freshly deleted account is not even a candidate.
    const candidateIds = await prisma.user.findMany({
      where: { deletedAt: { not: null, lt: new Date('2020-06-01') } },
      select: { id: true },
    });
    expect(candidateIds.map((u) => u.id)).toContain(stale.id);
    expect(candidateIds.map((u) => u.id)).not.toContain(fresh.id);

    await users.hardDelete(stale.id);
    await users.hardDelete(fresh.id);
  }, 30000);
});
