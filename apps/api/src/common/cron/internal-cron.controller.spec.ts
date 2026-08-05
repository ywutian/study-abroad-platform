import {
  BadRequestException,
  ExecutionContext,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    // Same length, different content — the timing-safe compare itself.
    expect(() =>
      guard.canActivate(httpContext({ [CRON_SECRET_HEADER]: 'b'.repeat(32) })),
    ).toThrow(UnauthorizedException);
  });

  it('accepts the exact secret', () => {
    const guard = new CronSecretGuard(configWith({ CRON_SECRET: SECRET }));
    expect(
      guard.canActivate(httpContext({ [CRON_SECRET_HEADER]: SECRET })),
    ).toBe(true);
  });
});

describe('InternalCronController', () => {
  function build(values: Record<string, string | undefined> = {}) {
    const registry = {
      list: jest
        .fn()
        .mockReturnValue([{ name: 'job-a', cronExpression: '0 3 * * *' }]),
      run: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CronRegistryService>;
    return {
      registry,
      controller: new InternalCronController(registry, configWith(values)),
    };
  }

  it('lists discovered jobs', () => {
    const { controller } = build();
    expect(controller.list()).toEqual({
      jobs: [{ name: 'job-a', cronExpression: '0 3 * * *' }],
    });
  });

  it('runs a job and reports duration', async () => {
    const { controller, registry } = build();
    const result = await controller.run('job-a');
    expect(registry.run).toHaveBeenCalledWith('job-a');
    expect(result).toMatchObject({ name: 'job-a', ran: true });
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
