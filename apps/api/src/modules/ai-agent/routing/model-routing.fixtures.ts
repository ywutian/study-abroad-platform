import {
  MODEL_TASKS,
  ModelTask,
  ModelRoutingPolicy,
} from './model-routing.policy';

/** Synthetic contract fixtures, not a production quality/pricing recommendation. */
export function routingFixture(): ModelRoutingPolicy {
  return {
    version: 1,
    revision: 'synthetic-v1',
    provider: 'openai',
    models: {
      'gpt-5.4-mini': {
        capabilities: ['text', 'tools', 'json'],
        contextWindow: 32000,
        maxOutputTokens: 2000,
      },
      'gpt-5.5': {
        capabilities: ['text', 'tools', 'json'],
        contextWindow: 32000,
        maxOutputTokens: 2000,
      },
    },
    routes: Object.fromEntries(
      MODEL_TASKS.map((task) => [
        task,
        {
          models:
            task.startsWith('analysis.') || task === 'agent.verify'
              ? ['gpt-5.5']
              : ['gpt-5.4-mini', 'gpt-5.5'],
          requires: ['text'],
          timeoutMs: 1000,
          maxOutputTokens: 500,
        },
      ]),
    ),
  };
}

export const ROUTING_CASES: Array<{
  task: ModelTask;
  prompt: string;
  expected: string;
}> = MODEL_TASKS.map((task) => ({
  task,
  prompt: `Synthetic ${task}: applicant SYNTHETIC_A has GPA 3.7. Reply exactly SYNTHETIC_A. Do not invent an admission probability.`,
  expected: 'SYNTHETIC_A',
}));
