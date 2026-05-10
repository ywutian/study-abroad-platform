import { resolveRequestLocale } from './request-locale.util';

describe('resolveRequestLocale', () => {
  it('prefers explicit x-locale over user locale and Accept-Language', () => {
    expect(
      resolveRequestLocale({
        explicitLocale: 'en',
        userLocale: 'zh',
        acceptLanguage: 'zh-CN,zh;q=0.9',
      }),
    ).toBe('en');
  });

  it('uses user locale when no explicit locale header is present', () => {
    expect(
      resolveRequestLocale({
        userLocale: 'en',
        acceptLanguage: 'zh-CN,zh;q=0.9',
      }),
    ).toBe('en');
  });

  it('ignores unsupported explicit locales and falls back to the user locale', () => {
    expect(
      resolveRequestLocale({
        explicitLocale: 'fr',
        userLocale: 'en',
        acceptLanguage: 'zh-CN,zh;q=0.9',
      }),
    ).toBe('en');
  });

  it('uses Accept-Language when no explicit or user locale exists', () => {
    expect(
      resolveRequestLocale({
        acceptLanguage: 'en-US,en;q=0.9,zh;q=0.8',
      }),
    ).toBe('en');
  });

  it('falls back to zh for unsupported locales', () => {
    expect(
      resolveRequestLocale({
        acceptLanguage: 'fr-FR,fr;q=0.9',
      }),
    ).toBe('zh');
  });
});
