import { createHash } from 'crypto';
import { z } from 'zod';

export const MODEL_TASKS = [
  'general',
  'agent.plan',
  'agent.replan',
  'agent.solve',
  'agent.verify',
  'agent.revise',
  'memory.summary',
  'memory.extract',
  'recommendation.generate',
  'analysis.school',
  'analysis.portfolio',
  'essay.debate',
] as const;
export type ModelTask = (typeof MODEL_TASKS)[number];
const capability = z.enum(['text', 'tools', 'json']);
export const reasoningEffortSchema = z.enum([
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]);
export const analysisSegmentSchema = z.enum(['assessment', 'actions']);
export type AnalysisSegment = z.infer<typeof analysisSegmentSchema>;
const modelId = z.string().regex(/^gpt-[a-z0-9.-]{1,80}$/);
const routeSchema = z
  .object({
    models: z.array(modelId).min(1).max(2),
    requires: z.array(capability).min(1),
    timeoutMs: z.number().int().min(100).max(120000),
    maxOutputTokens: z.number().int().min(256).max(16000),
    // Optional without defaults: legacy snapshot hashes must remain unchanged.
    reasoningEffort: reasoningEffortSchema.optional(),
    execution: z.enum(['single', 'segmented']).optional(),
    analysisOptimization: z.enum(['compact-v1', 'shared-v1']).optional(),
    segmentationMaxSchools: z.number().int().min(1).max(5).optional(),
  })
  .strict();
export const routingPolicySchema = z
  .object({
    version: z.literal(1),
    revision: z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),
    provider: z.literal('openai'),
    models: z
      .record(
        modelId,
        z
          .object({
            capabilities: z.array(capability).min(1),
            contextWindow: z.number().int().min(1024).max(2000000),
            maxOutputTokens: z.number().int().min(256).max(16000),
            reasoningEfforts: z.array(reasoningEffortSchema).min(1).optional(),
          })
          .strict(),
      )
      .refine(
        (models) =>
          Object.keys(models).length > 0 && Object.keys(models).length <= 16,
      ),
    routes: z.record(z.enum(MODEL_TASKS), routeSchema),
  })
  .strict()
  .superRefine((policy, ctx) => {
    for (const task of MODEL_TASKS) {
      const route = policy.routes[task];
      if (!route || new Set(route.models).size !== route.models.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Missing or duplicate route',
        });
        continue;
      }
      for (const id of route.models) {
        const model = policy.models[id];
        if (
          !model ||
          route.requires.some((item) => !model.capabilities.includes(item)) ||
          route.maxOutputTokens > model.maxOutputTokens ||
          route.maxOutputTokens >= model.contextWindow ||
          (route.reasoningEffort !== undefined &&
            !model.reasoningEfforts?.includes(route.reasoningEffort))
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid route capability',
          });
        }
      }
      if (
        route.execution !== undefined &&
        task !== 'analysis.school' &&
        task !== 'analysis.portfolio'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Analysis execution mode on non-analysis task',
        });
      }
      if (
        route.analysisOptimization !== undefined &&
        (!task.startsWith('analysis.') || route.execution === undefined)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Analysis optimization requires explicit analysis execution',
        });
      }
      if (
        route.analysisOptimization === 'shared-v1' &&
        (task !== 'analysis.school' ||
          route.execution !== 'single' ||
          route.maxOutputTokens < 3000)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Shared analysis requires single school execution and paired output capacity',
        });
      }
      if (
        route.segmentationMaxSchools !== undefined &&
        route.execution !== 'segmented'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Segmentation limit requires segmented execution',
        });
      }
    }
  });
export type ModelRoutingPolicy = z.infer<typeof routingPolicySchema>;
export interface ModelRoutingSnapshot {
  version: 1;
  policy: ModelRoutingPolicy;
  hash: string;
}
export interface ModelRouteAttempt {
  task: ModelTask;
  policyHash: string;
  model: string;
  attempt: number;
  reason: 'primary' | 'transient_failure' | 'output_validation';
  outcome: 'success' | 'failure';
  code: string;
  tokens: number;
  latencyMs: number;
  segment?: AnalysisSegment;
  reasoningEffort?: z.infer<typeof reasoningEffortSchema>;
}
export const modelAttemptsSchema = z
  .array(
    z
      .object({
        task: z.enum(MODEL_TASKS),
        policyHash: z.string().regex(/^[a-f0-9]{64}$/),
        model: modelId,
        attempt: z.number().int().min(1).max(2),
        reason: z.enum(['primary', 'transient_failure', 'output_validation']),
        outcome: z.enum(['success', 'failure']),
        code: z.string().regex(/^[A-Z_]{1,80}$/),
        tokens: z.number().int().nonnegative().safe(),
        latencyMs: z.number().int().nonnegative().safe(),
        segment: analysisSegmentSchema.optional(),
        reasoningEffort: reasoningEffortSchema.optional(),
      })
      .strict(),
  )
  .max(64);
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  return value;
}
export function routingHash(policy: ModelRoutingPolicy): string {
  return createHash('sha256')
    .update(JSON.stringify(stable(policy)))
    .digest('hex');
}
export function parseRoutingSnapshot(value: unknown): ModelRoutingSnapshot {
  const parsed = z
    .object({
      version: z.literal(1),
      hash: z.string(),
      policy: routingPolicySchema,
    })
    .strict()
    .safeParse(value);
  if (!parsed.success || parsed.data.hash !== routingHash(parsed.data.policy))
    throw new Error('MODEL_ROUTING_SNAPSHOT_INVALID');
  return parsed.data;
}
export function configuredRoutingSnapshot(
  get: (key: string) => unknown,
): ModelRoutingSnapshot | undefined {
  if (get('AI_AGENT_MODEL_ROUTING_V1') !== 'true') return undefined;
  try {
    if (get('LLM_PROVIDER') !== 'openai') throw new Error();
    const raw = get('AI_AGENT_MODEL_ROUTING_CONFIG');
    if (typeof raw !== 'string' || raw.length > 32768) throw new Error();
    const policy = routingPolicySchema.parse(JSON.parse(raw));
    return { version: 1, policy, hash: routingHash(policy) };
  } catch {
    throw new Error('MODEL_ROUTING_CONFIG_INVALID');
  }
}
