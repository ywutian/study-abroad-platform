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
