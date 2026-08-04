import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PointsService } from '../src/modules/points/incentive.service';
import { PointsConfigService } from '../src/modules/points/points-config.service';

/**
 * The points balance invariant against a real database.
 *
 * Two things here are unprovable in a unit test, and both are the whole point:
 *
 * 1. **The CHECK constraint.** `User_points_non_negative` lives only in
 *    migrations/20260804230000_user_points_non_negative — Prisma cannot express
 *    a CHECK, so it is invisible in schema.prisma and nothing in the type system
 *    or the unit suite knows it exists. If the migration is reverted, or a
 *    future `prisma migrate dev` regenerates history without it, every other
 *    test in the repo still passes. This suite is the only thing that notices.
 *
 * 2. **Concurrency.** `adjustPoints` puts the sufficiency check in the WHERE
 *    (`points: { gte: -pointValue }`) so that the check and the debit are one
 *    statement. The unit spec asserts that predicate is present, which catches
 *    the guard being moved back into a preceding read — but it cannot show that
 *    two debits racing against the same pre-spend balance produce one winner,
 *    because a mocked client has no Postgres and no isolation level. That was
 *    the actual bug: under READ COMMITTED both readers saw the same balance and
 *    both wrote.
 *
 * WHY THE SERVICE TESTS FORCE THE FEATURE ON
 * ------------------------------------------
 * `PointsConfigService.FEATURE_AVAILABLE` is a hardcoded `false` — a product
 * decision that no setting can override — so `adjustPoints` returns early and
 * never reaches its own guard. The race is therefore unreachable in production
 * today, which is also why the constraint could be added as a plain follow-up
 * rather than a hotfix.
 *
 * The two service tests below stub `isEnabled` to exercise the path anyway. The
 * moment the economy is switched back on is exactly the moment the guard has to
 * already be correct, and that is not a moment to be re-deriving what
 * READ COMMITTED does. The constraint tests need no stub: the database enforces
 * the invariant whether the feature is on or off.
 */
describe('Points balance invariant (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let points: PointsService;
  let pointsConfig: PointsConfigService;

  const mkUser = async (startingBalance: number) =>
    prisma.user.create({
      data: {
        email: `points-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        passwordHash: 'x',
        points: startingBalance,
      },
    });

  const balanceOf = async (id: string) =>
    (
      await prisma.user.findUniqueOrThrow({
        where: { id },
        select: { points: true },
      })
    ).points;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    points = app.get(PointsService);
    pointsConfig = app.get(PointsConfigService);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** See "WHY THE SERVICE TESTS FORCE THE FEATURE ON" above. */
  const withPointsEconomyOn = () =>
    jest.spyOn(pointsConfig, 'isEnabled').mockResolvedValue(true);

  it('rejects a write that would take a balance negative', async () => {
    const user = await mkUser(3);

    // Straight through Prisma, deliberately bypassing adjustPoints — this is
    // the second writer the constraint exists for. Today there is no such
    // caller; the constraint is what keeps that true.
    await expect(
      prisma.user.update({
        where: { id: user.id },
        data: { points: { decrement: 5 } },
      }),
    ).rejects.toThrow(/User_points_non_negative/);

    expect(await balanceOf(user.id)).toBe(3);
  });

  it('rejects a row created with a negative balance', async () => {
    await expect(mkUser(-1)).rejects.toThrow(/User_points_non_negative/);
  });

  it('lets exactly one of two concurrent debits win', async () => {
    withPointsEconomyOn();
    // 10 on hand, two debits of 7 in flight. Sequentially the second must fail.
    // Concurrently, a read-then-write guard lets both through and lands on -4.
    const user = await mkUser(10);

    const results = await Promise.all([
      points.adjustPoints(user.id, 'RACE_A', undefined, -7),
      points.adjustPoints(user.id, 'RACE_B', undefined, -7),
    ]);

    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.find((r) => !r.success)?.message).toBe('积分不足');
    expect(await balanceOf(user.id)).toBe(3);
  });

  it('debits through the service the way a normal spend does', async () => {
    withPointsEconomyOn();
    const user = await mkUser(10);

    const ok = await points.adjustPoints(user.id, 'SPEND_OK', undefined, -4);
    expect(ok.success).toBe(true);
    expect(await balanceOf(user.id)).toBe(6);

    // Over-spend is answered, not thrown: the WHERE matches nothing and the
    // service reports it. The constraint above never gets a chance to fire,
    // which is the correct division of labour between the two layers.
    const nope = await points.adjustPoints(
      user.id,
      'SPEND_TOO_MUCH',
      undefined,
      -99,
    );
    expect(nope.success).toBe(false);
    expect(nope.message).toBe('积分不足');
    expect(await balanceOf(user.id)).toBe(6);
  });
});
