import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { AnalysisSegment } from '../ai-agent/routing/model-routing.policy';

export type AnalysisTask = 'analysis.school' | 'analysis.portfolio';
const sentence = z
  .string()
  .trim()
  .min(1)
  .max(360)
  .regex(/^[^%％]*$/);
const list = z.array(sentence).max(3);
const evidence = z.array(z.string().min(1).max(160)).max(12);
const schoolAssessment = z
  .object({
    summary: sentence,
    whyThisIsHard: list,
    compensatingStrengths: list,
    topGaps: list,
    hardStopRisks: list,
    uncertainty: z
      .object({
        intervalLabel: z.enum(['tight', 'balanced', 'wide']),
        reasons: list,
      })
      .strict(),
    evidenceIds: evidence,
    unknowns: list,
  })
  .strict();
const schoolActions = z
  .object({
    nextActions: list.min(1),
    recourse: z
      .object({
        goal: sentence,
        recommendedChanges: z
          .array(
            z
              .object({
                action: sentence,
                rationale: sentence,
                effort: z.enum(['low', 'medium', 'high']),
                timeHorizon: z.enum(['now', 'next90Days', 'beforeSubmission']),
                blockedBy: list,
              })
              .strict(),
          )
          .min(1)
          .max(2),
        estimatedDirection: z.enum(['upside', 'stabilize', 'mixed']),
        // Four independent constraints (e.g. international, aid, reach, blind)
        // can all matter; keep a finite bound without discarding a valid plan.
        constraints: z.array(sentence).max(4),
        whyNotGuaranteed: sentence,
      })
      .strict(),
    evidenceIds: evidence,
    unknowns: list,
  })
  .strict();
const portfolioAssessment = z
  .object({
    verdict: sentence,
    balance: z.enum([
      'balanced',
      'reachHeavy',
      'safetyHeavy',
      'undermatch',
      'insufficient',
    ]),
    keyReasons: list,
    riskBoundaries: list,
    unknowns: list,
  })
  .strict();
const portfolioActions = z
  .object({
    actionPlan: z
      .object({ now: list.min(1), next90Days: list, beforeSubmission: list })
      .strict(),
    unknowns: list,
  })
  .strict();

export function analysisSchema(
  task: AnalysisTask,
  segment: AnalysisSegment | 'complete',
) {
  const assessment =
    task === 'analysis.school' ? schoolAssessment : portfolioAssessment;
  const actions = task === 'analysis.school' ? schoolActions : portfolioActions;
  return segment === 'complete'
    ? assessment.merge(actions).strict()
    : segment === 'assessment'
      ? assessment
      : actions;
}

/** Same source as local validation; the transport never gets a weaker hand-written schema. */
export function analysisResponseFormat(
  task: AnalysisTask,
  segment: AnalysisSegment | 'complete',
) {
  const { json_schema, type } = zodResponseFormat(
    analysisSchema(task, segment),
    `${task.replace('.', '_')}_${segment}`,
  );
  return { type, json_schema };
}

/** Strict stage contract; no repairing malformed/partial JSON into success. */
export function parseAnalysisSegment(
  task: AnalysisTask,
  segment: AnalysisSegment | 'complete',
  content: string,
  allowedEvidenceIds: string[],
): Record<string, unknown> | undefined {
  try {
    const schema = analysisSchema(task, segment);
    const result = schema.safeParse(JSON.parse(content));
    if (!result.success) return undefined;
    const parsed: Record<string, unknown> = result.data;
    // Probability remains in the deterministic response fields. Narrative stages
    // do not restate percentages, avoiding a second, unverifiable numeric source.
    if (/%|％|百分之/.test(content)) return undefined;
    if (
      Array.isArray(parsed.evidenceIds) &&
      (parsed.evidenceIds.some(
        (id) => !allowedEvidenceIds.includes(String(id)),
      ) ||
        (allowedEvidenceIds.length > 0 && parsed.evidenceIds.length === 0))
    )
      return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function mergeAnalysisSegments(
  assessment: Record<string, unknown>,
  actions: Record<string, unknown>,
): Record<string, unknown> {
  const unique = (key: string) => [
    ...new Set([
      ...(Array.isArray(assessment[key]) ? assessment[key] : []),
      ...(Array.isArray(actions[key]) ? actions[key] : []),
    ]),
  ];
  return {
    ...assessment,
    ...actions,
    unknowns: unique('unknowns'),
    ...(assessment.evidenceIds ? { evidenceIds: unique('evidenceIds') } : {}),
  };
}
