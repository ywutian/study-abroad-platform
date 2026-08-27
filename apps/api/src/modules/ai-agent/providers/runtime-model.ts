/** One configured model for Agent, reflection, and ordinary business calls. */
export function configuredRuntimeModel(
  get: (key: string) => string | undefined,
): string | undefined {
  const key =
    get('LLM_PROVIDER') === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL';
  return get(key)?.trim() || undefined;
}

export function runtimeModel(get: (key: string) => string | undefined): string {
  const configured = configuredRuntimeModel(get);
  if (configured) return configured;
  if (get('LLM_PROVIDER') === 'anthropic') {
    throw new Error(
      'ANTHROPIC_MODEL is required for the native Claude provider',
    );
  }
  return 'gpt-5.4-mini';
}
