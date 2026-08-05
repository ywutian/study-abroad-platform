import { validateEnv } from './env.validation';

const requiredConfig = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/study_abroad',
  JWT_SECRET: 'test-jwt-secret-at-least-16-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-16-characters',
};

describe('payment environment retirement gate', () => {
  it('defaults payment writes to disabled with no provider', () => {
    const result = validateEnv({
      ...requiredConfig,
      NODE_ENV: 'test',
    });

    expect(result.PAYMENTS_ENABLED).toBe('false');
    expect(result.PAYMENT_PROVIDER).toBe('none');
  });

  it('refuses to boot production with the simulator enabled', () => {
    expect(() =>
      validateEnv({
        ...requiredConfig,
        NODE_ENV: 'production',
        PAYMENTS_ENABLED: 'true',
        PAYMENT_PROVIDER: 'simulator',
        VAULT_ENCRYPTION_KEY: 'vault-key-at-least-32-characters-long',
        CORS_ORIGINS: 'https://app.example.com',
        FRONTEND_URL: 'https://app.example.com',
      }),
    ).toThrow(/paid subscriptions are retired/);
  });
});

/**
 * The whole thesis of the http cron driver is "production must not silently
 * have every scheduled job switched off". Without CRON_SECRET the dispatcher
 * is fail-closed 401, so CRON_DRIVER=http + no secret is exactly that state —
 * and it only ever evaluates inside the production branch, so no local run
 * exercises it. These are the tests that do.
 */
describe('cron driver environment gate', () => {
  const prodConfig = {
    ...requiredConfig,
    NODE_ENV: 'production',
    VAULT_ENCRYPTION_KEY: 'vault-key-at-least-32-characters-long',
    CORS_ORIGINS: 'https://app.example.com',
    FRONTEND_URL: 'https://app.example.com',
  };

  it('defaults to the in-process timer driver', () => {
    expect(
      validateEnv({ ...requiredConfig, NODE_ENV: 'test' }).CRON_DRIVER,
    ).toBe('timer');
  });

  it('refuses to boot production with CRON_DRIVER=http and no CRON_SECRET', () => {
    expect(() => validateEnv({ ...prodConfig, CRON_DRIVER: 'http' })).toThrow(
      /CRON_SECRET must be set when CRON_DRIVER=http/,
    );
  });

  it('boots production with http + a secret', () => {
    expect(
      validateEnv({
        ...prodConfig,
        CRON_DRIVER: 'http',
        CRON_SECRET: 'a'.repeat(32),
      }).CRON_DRIVER,
    ).toBe('http');
  });

  it('leaves staging free to run http with no secret (schedules deliberately off there)', () => {
    expect(
      validateEnv({
        ...requiredConfig,
        NODE_ENV: 'staging',
        CRON_DRIVER: 'http',
      }).CRON_SECRET,
    ).toBeUndefined();
  });
});
