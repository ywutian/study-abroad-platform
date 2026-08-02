import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntlError, IntlErrorCode } from 'next-intl';

const captureMessage = vi.fn();
const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
  captureException: (...args: unknown[]) => captureException(...args),
}));

/** 每个用例都重新 import，好把模块级的去重 Set 清空 */
async function freshReporter() {
  vi.resetModules();
  return (await import('./report-intl-error')).reportIntlError;
}

function missing(key: string) {
  return new IntlError(
    IntlErrorCode.MISSING_MESSAGE,
    `Could not resolve \`${key}\` in messages for locale \`zh\`.`
  );
}

describe('reportIntlError', () => {
  beforeEach(() => {
    captureMessage.mockClear();
    captureException.mockClear();
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('把反引号里的 key 摘出来送进 Sentry', async () => {
    (await freshReporter())(missing('admin.dataReview.stats.pendingStaging'));

    expect(captureMessage).toHaveBeenCalledOnce();
    const [message, options] = captureMessage.mock.calls[0] as [
      string,
      { tags: { i18n_key: string } },
    ];
    expect(message).toContain('admin.dataReview.stats.pendingStaging');
    expect(options.tags.i18n_key).toBe('admin.dataReview.stats.pendingStaging');
  });

  it('同一个 key 只上报一次 —— 列表里渲染上百次不该打满配额', async () => {
    const report = await freshReporter();
    report(missing('forum.categoryTeam'));
    report(missing('forum.categoryTeam'));
    report(missing('forum.categoryTeam'));

    expect(captureMessage).toHaveBeenCalledOnce();
  });

  it('不同 key 分别上报', async () => {
    const report = await freshReporter();
    report(missing('home.hero.headline'));
    report(missing('home.hero.trustLine'));

    expect(captureMessage).toHaveBeenCalledTimes(2);
  });

  // 格式串写错这类是真 bug，生产只打 console 等于没上报 —— 必须走 Sentry 的 error 级别
  it('非 MISSING_MESSAGE 在生产走 captureException，不混进 missing 的 warning', async () => {
    (await freshReporter())(new IntlError(IntlErrorCode.FORMATTING_ERROR, 'bad ICU argument'));

    expect(captureMessage).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledOnce();
    const [, options] = captureException.mock.calls[0] as [
      unknown,
      { tags: { i18n_code: string } },
    ];
    expect(options.tags.i18n_code).toBe(IntlErrorCode.FORMATTING_ERROR);
  });

  it('非 MISSING_MESSAGE 在开发环境只打 console', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (await freshReporter())(new IntlError(IntlErrorCode.FORMATTING_ERROR, 'bad ICU argument'));

    expect(captureException).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledOnce();
    consoleWarn.mockRestore();
  });

  it('开发环境只打 console，不发 Sentry', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (await freshReporter())(missing('vault.websitePlaceholder'));

    expect(captureMessage).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledOnce();
    consoleWarn.mockRestore();
  });
});
