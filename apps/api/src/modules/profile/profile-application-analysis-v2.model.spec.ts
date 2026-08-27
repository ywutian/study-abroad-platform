import { ProfileApplicationAnalysisV2Service } from './profile-application-analysis-v2.service';

describe('Application analysis model selection after environment loading', () => {
  const keys = ['LLM_PROVIDER', 'OPENAI_MODEL', 'ANTHROPIC_MODEL'] as const;
  let previous: Record<string, string | undefined>;
  beforeEach(() => {
    previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];
  });
  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  function service() {
    // No business methods are invoked; only provider model initialization.
    const dependencies = [{}, {}, {}, {}, {}] as ConstructorParameters<
      typeof ProfileApplicationAnalysisV2Service
    >;
    return new ProfileApplicationAnalysisV2Service(...dependencies);
  }

  it('uses native configuration loaded after the module was imported', () => {
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-5';
    process.env.OPENAI_MODEL = 'gpt-5.4-mini';
    expect(service()['defaultModel']).toBe('claude-sonnet-5');
  });

  it('preserves OpenAI defaults and reads explicit OpenAI configuration', () => {
    expect(service()['defaultModel']).toBe('gpt-5.4-mini');
    process.env.OPENAI_MODEL = 'gpt-5.5';
    expect(service()['defaultModel']).toBe('gpt-5.5');
  });
});
