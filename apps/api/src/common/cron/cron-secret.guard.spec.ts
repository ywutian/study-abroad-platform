import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Pins the COMPARATOR, not the outcome. The guard hashes both sides to 32-byte
 * digests before comparing, so an equal-length wrong secret is
 * indistinguishable from any other wrong secret — which means a plain `===`
 * passes every outcome-based assertion in `internal-cron.controller.spec.ts`
 * (proven during acceptance review: swapping in `===` left all 8 green). The
 * only thing that falsifies it is watching which function does the compare,
 * and a named import (`import { timingSafeEqual } from 'crypto'`) binds
 * directly, so `jest.spyOn` on the module object never fires — the mock has to
 * be hoisted, hence this separate file.
 *
 * Same lesson as `.claude/rules/backend.md`'s "assert the WHERE in the spec,
 * not just the outcome".
 */
const timingSafeEqualSpy = jest.fn();

jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    timingSafeEqual: (a: Buffer, b: Buffer) => {
      timingSafeEqualSpy(a, b);
      return actual.timingSafeEqual(a, b);
    },
  };
});

// Imported after the mock on purpose, so the guard binds the wrapped function.
import { CronSecretGuard, CRON_SECRET_HEADER } from './cron-secret.guard';

describe('CronSecretGuard comparator', () => {
  const SECRET = 'e'.repeat(32);
  const context = (headers: Record<string, string>) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => timingSafeEqualSpy.mockClear());

  it('compares with crypto.timingSafeEqual over equal-length digests', () => {
    const guard = new CronSecretGuard({
      get: () => SECRET,
    } as unknown as ConfigService);

    expect(guard.canActivate(context({ [CRON_SECRET_HEADER]: SECRET }))).toBe(
      true,
    );

    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
    const [provided, expected] = timingSafeEqualSpy.mock.calls[0] as [
      Buffer,
      Buffer,
    ];
    expect(provided).toHaveLength(32);
    expect(expected).toHaveLength(32);
  });

  it('reaches the timing-safe compare even for a wrong secret (no early bail on content)', () => {
    const guard = new CronSecretGuard({
      get: () => SECRET,
    } as unknown as ConfigService);

    expect(() =>
      guard.canActivate(context({ [CRON_SECRET_HEADER]: 'f'.repeat(32) })),
    ).toThrow();
    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
  });
});
