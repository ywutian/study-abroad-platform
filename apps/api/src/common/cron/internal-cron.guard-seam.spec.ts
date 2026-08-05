import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CronRegistryService } from './cron-registry.service';
import { CronSecretGuard, CRON_SECRET_HEADER } from './cron-secret.guard';
import { InternalCronController } from './internal-cron.controller';

/**
 * The SEAM, not the parts. `CronSecretGuard` is unit-tested and the controller
 * is unit-tested, and both stayed green when `@UseGuards(CronSecretGuard)` was
 * deleted from the controller during acceptance review — leaving an
 * unauthenticated `POST /internal/cron/account-purge…/run`, i.e. an open
 * trigger for irreversible hard deletion. Two components each proven correct
 * prove nothing about whether they are attached.
 *
 * So this boots a real Nest app and drives real HTTP: no header must be 401
 * BEFORE the registry is ever consulted. If someone detaches the guard, the
 * first test here goes red.
 */
describe('InternalCronController ↔ CronSecretGuard (wiring)', () => {
  const SECRET = 'c'.repeat(32);
  let app: INestApplication;
  const run = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    process.env.CRON_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [InternalCronController],
      providers: [
        CronSecretGuard,
        { provide: CronRegistryService, useValue: { list: () => [], run } },
        {
          provide: SchedulerRegistry,
          useValue: { getCronJobs: () => new Map() },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    delete process.env.CRON_SECRET;
    await app?.close();
  });

  beforeEach(() => run.mockClear());

  it('refuses a run with NO secret — and never reaches the job', async () => {
    await request(app.getHttpServer())
      .post('/internal/cron/some-job/run')
      .expect(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses a run with a WRONG secret', async () => {
    await request(app.getHttpServer())
      .post('/internal/cron/some-job/run')
      .set(CRON_SECRET_HEADER, 'd'.repeat(32))
      .expect(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses to LIST jobs without the secret (no name enumeration)', async () => {
    await request(app.getHttpServer()).get('/internal/cron').expect(401);
  });

  it('accepts the correct secret and dispatches', async () => {
    await request(app.getHttpServer())
      .post('/internal/cron/some-job/run')
      .set(CRON_SECRET_HEADER, SECRET)
      .expect(201);
    expect(run).toHaveBeenCalledWith('some-job');
  });
});
