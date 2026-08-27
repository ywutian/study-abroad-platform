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

describe('AI agent harness environment gate', () => {
  it('defaults to the legacy workflow and advisory mode', () => {
    const result = validateEnv({ ...requiredConfig, NODE_ENV: 'test' });

    expect(result.LLM_PROVIDER).toBe('openai');
    expect(result.AI_AGENT_NATIVE_CLAUDE_V1).toBe('false');
    expect(result.AI_AGENT_HARNESS_V1).toBe('false');
    expect(result.AI_AGENT_HARNESS_MODE).toBe('advisory');
    expect(result.AI_AGENT_APPROVALS_V1).toBe('false');
    expect(result.AI_AGENT_APPROVAL_TTL_MS).toBe(900000);
    expect(result.AI_AGENT_RUN_TTL_MS).toBe(86400000);
    expect(result.AI_AGENT_EXECUTION_LEASE_MS).toBe(120000);
    expect(result.AI_AGENT_CONTEXT_V1).toBe('false');
    expect(result.AI_AGENT_SKILLS_V1).toBe('false');
    expect(result.AI_AGENT_SKILLS_EVOLUTION_V1).toBe('false');
    expect(result.AI_AGENT_SKILLS_AUTO_PUBLISH_V1).toBe('false');
    expect(result.AI_AGENT_MAX_TOKENS_PER_RUN).toBe(24000);
    expect(result.AI_AGENT_MAX_DURATION_MS).toBe(120000);
    expect(result.AI_AGENT_CONTEXT_RECENT_MESSAGES).toBe(10);
  });

  it('accepts action mode when the harness is explicitly enabled', () => {
    const result = validateEnv({
      ...requiredConfig,
      NODE_ENV: 'test',
      AI_AGENT_HARNESS_V1: 'true',
      AI_AGENT_HARNESS_MODE: 'action',
      AI_AGENT_APPROVALS_V1: 'true',
      AI_AGENT_APPROVAL_TTL_MS: '60000',
      AI_AGENT_RUN_TTL_MS: '120000',
      AI_AGENT_EXECUTION_LEASE_MS: '30000',
      AI_AGENT_CONTEXT_V1: 'true',
      AI_AGENT_SKILLS_V1: 'true',
      AI_AGENT_SKILLS_EVOLUTION_V1: 'true',
      AI_AGENT_SKILLS_AUTO_PUBLISH_V1: 'true',
      AI_AGENT_MAX_TOKENS_PER_RUN: '12000',
      AI_AGENT_MAX_DURATION_MS: '60000',
      AI_AGENT_CONTEXT_RECENT_MESSAGES: '8',
    });

    expect(result.AI_AGENT_HARNESS_V1).toBe('true');
    expect(result.AI_AGENT_HARNESS_MODE).toBe('action');
    expect(result.AI_AGENT_APPROVALS_V1).toBe('true');
    expect(result.AI_AGENT_APPROVAL_TTL_MS).toBe(60000);
    expect(result.AI_AGENT_RUN_TTL_MS).toBe(120000);
    expect(result.AI_AGENT_EXECUTION_LEASE_MS).toBe(30000);
    expect(result.AI_AGENT_CONTEXT_V1).toBe('true');
    expect(result.AI_AGENT_SKILLS_V1).toBe('true');
    expect(result.AI_AGENT_SKILLS_EVOLUTION_V1).toBe('true');
    expect(result.AI_AGENT_SKILLS_AUTO_PUBLISH_V1).toBe('true');
    expect(result.AI_AGENT_MAX_TOKENS_PER_RUN).toBe(12000);
    expect(result.AI_AGENT_MAX_DURATION_MS).toBe(60000);
    expect(result.AI_AGENT_CONTEXT_RECENT_MESSAGES).toBe(8);
  });

  it('rejects native Claude without an explicit complete opt-in', () => {
    expect(() =>
      validateEnv({
        ...requiredConfig,
        NODE_ENV: 'test',
        LLM_PROVIDER: 'anthropic',
      }),
    ).toThrow(/LLM_PROVIDER/);
  });

  it('accepts the explicitly configured native provider', () => {
    const result = validateEnv({
      ...requiredConfig,
      NODE_ENV: 'test',
      LLM_PROVIDER: 'anthropic',
      AI_AGENT_NATIVE_CLAUDE_V1: 'true',
      ANTHROPIC_API_KEY: 'synthetic',
      ANTHROPIC_MODEL: 'claude-sonnet-5',
      ANTHROPIC_BASE_URL: 'https://relay.example/api/v1',
    });
    expect(result.LLM_PROVIDER).toBe('anthropic');
    expect(result.ANTHROPIC_MODEL).toBe('claude-sonnet-5');
  });

  it.each([
    'http://relay.example',
    'https://user:secret@relay.example',
    'https://relay.example?key=value',
  ])('rejects unsafe native base URL', (url) => {
    expect(() =>
      validateEnv({
        ...requiredConfig,
        NODE_ENV: 'test',
        ANTHROPIC_BASE_URL: url,
      }),
    ).toThrow(/ANTHROPIC_BASE_URL/);
  });

  it('refuses evolution or auto-publish when their parent feature is disabled', () => {
    const production = {
      ...requiredConfig,
      NODE_ENV: 'production',
      VAULT_ENCRYPTION_KEY: 'vault-key-at-least-32-characters-long',
      CORS_ORIGINS: 'https://app.example.com',
      FRONTEND_URL: 'https://app.example.com',
    };
    expect(() =>
      validateEnv({
        ...production,
        AI_AGENT_SKILLS_EVOLUTION_V1: 'true',
      }),
    ).toThrow(/EVOLUTION_V1 requires AI_AGENT_SKILLS_V1/);
    expect(() =>
      validateEnv({
        ...production,
        AI_AGENT_SKILLS_V1: 'true',
        AI_AGENT_SKILLS_AUTO_PUBLISH_V1: 'true',
      }),
    ).toThrow(/AUTO_PUBLISH_V1 requires AI_AGENT_SKILLS_EVOLUTION_V1/);
  });

  it('requires a managed production administrator for acceptance operations', () => {
    expect(() =>
      validateEnv({
        ...requiredConfig,
        NODE_ENV: 'production',
        VAULT_ENCRYPTION_KEY: 'vault-key-at-least-32-characters-long',
        CORS_ORIGINS: 'https://app.example.com',
        FRONTEND_URL: 'https://app.example.com',
        AI_AGENT_ACCEPTANCE_V1: 'true',
      }),
    ).toThrow(
      /managed ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD_HASH_B64/,
    );
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
