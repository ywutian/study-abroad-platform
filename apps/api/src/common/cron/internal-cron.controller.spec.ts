import {
  BadRequestException,
  ExecutionContext,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronRegistryService } from './cron-registry.service';
import { CronSecretGuard, CRON_SECRET_HEADER } from './cron-secret.guard';
import { InternalCronController } from './internal-cron.controller';

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function httpContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('CronSecretGuard', () => {
  const SECRET = 'a'.repeat(32);

  it('fails closed when CRON_SECRET is not configured', () => {
    const guard = new CronSecretGuard(configWith({}));
    expect(() =>
      guard.canActivate(httpContext({ [CRON_SECRET_HEADER]: SECRET })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a missing or wrong secret', () => {
    const guard = new CronSecretGuard(configWith({ CRON_SECRET: SECRET }));
    expect(() => guard.canActivate(httpContext({}))).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      guard.canActivate(httpContext({ [CRON_SECRET_HEADER]: 'wrong' })),
    ).toThrow(UnauthorizedException);
    expect(() =>
      guard.canActivate(httpContext({ [CRON_SECRET_HEADER]: 'b'.repeat(32) })),
    ).toThrow(UnauthorizedException);
  });

  // The comparator itself (timingSafeEqual, not ===) is pinned in
  // cron-secret.guard.spec.ts — it needs a module mock, which has to be
  // hoisted to the top of its own file.

  it('accepts the exact secret', () => {
    const guard = new CronSecretGuard(configWith({ CRON_SECRET: SECRET }));
    expect(
      guard.canActivate(httpContext({ [CRON_SECRET_HEADER]: SECRET })),
    ).toBe(true);
  });
});

describe('InternalCronController', () => {
  function build(
    values: Record<string, string | undefined> = {},
    timers: Record<string, object> = {},
  ) {
    const registry = {
      list: jest
        .fn()
        .mockReturnValue([{ name: 'job-a', cronExpression: '0 3 * * *' }]),
      run: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CronRegistryService>;
    const scheduler = {
      getCronJobs: () => new Map(Object.entries(timers)),
    } as unknown as SchedulerRegistry;
    return {
      registry,
      controller: new InternalCronController(
        registry,
        configWith(values),
        scheduler,
      ),
    };
  }

  it('lists discovered jobs alongside the driver and in-process timer count', () => {
    const { controller } = build({ CRON_DRIVER: 'http' });
    expect(controller.list()).toEqual({
      driver: 'http',
      inProcessTimers: 0,
      jobs: [{ name: 'job-a', cronExpression: '0 3 * * *' }],
    });
  });

  /**
   * The deploy asserts on these two fields. If CRON_DRIVER ever falls out of
   * the deploy's `--set-env-vars` (which replaces the whole set), prod runs
   * BOTH a starved in-process timer and Cloud Scheduler — and every other
   * check stays green. This is the field that catches it.
   */
  it('reports the timer driver and a non-zero timer count when timers are registered', () => {
    const { controller } = build({}, { 'some-timer': {} });
    expect(controller.list()).toMatchObject({
      driver: 'timer',
      inProcessTimers: 1,
    });
  });

  it('runs a job and reports duration', async () => {
    const { controller, registry } = build();
    const result = await controller.run('job-a');
    expect(registry.run).toHaveBeenCalledWith('job-a');
    expect(result).toMatchObject({ name: 'job-a', dispatched: true });
    expect(typeof result.durationMs).toBe('number');
  });

  it('rejects malformed job names before touching the registry', async () => {
    const { controller, registry } = build();
    await expect(controller.run('Bad/Name!')).rejects.toThrow(
      BadRequestException,
    );
    expect(registry.run).not.toHaveBeenCalled();
  });

  it('answers 503 when the SCHEDULERS_ENABLED kill switch is off', async () => {
    const { controller, registry } = build({ SCHEDULERS_ENABLED: 'false' });
    await expect(controller.run('job-a')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(registry.run).not.toHaveBeenCalled();
  });

  it('propagates registry NotFound for unknown jobs', async () => {
    const { controller, registry } = build();
    registry.run.mockRejectedValue(new NotFoundException());
    await expect(controller.run('missing-job')).rejects.toThrow(
      NotFoundException,
    );
  });
});
