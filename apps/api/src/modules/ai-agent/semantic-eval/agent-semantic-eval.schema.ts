import { z } from 'zod';
import type { SemanticEvalSubmission } from './agent-semantic-eval.types';
import {
  SEMANTIC_EVAL_RUBRIC_VERSION,
  SEMANTIC_RUBRIC_AXES,
} from './agent-semantic-eval.types';

const scoresSchema = z
  .object(
    Object.fromEntries(
      SEMANTIC_RUBRIC_AXES.map((axis) => [
        axis,
        z.number().int().min(0).max(4),
      ]),
    ) as Record<(typeof SEMANTIC_RUBRIC_AXES)[number], z.ZodNumber>,
  )
  .strict();

const reviewSchema = z
  .object({
    reviewerType: z.enum(['codex', 'human_expert']),
    reviewerId: z.string().trim().min(1).max(120),
    rubricVersion: z.literal(SEMANTIC_EVAL_RUBRIC_VERSION),
    independent: z.boolean(),
    scores: scoresSchema,
    reasonCodes: z.array(z.string().trim().min(1).max(120)).max(20),
  })
  .strict();

const submissionSchema = z
  .object({
    schemaVersion: z.literal(1),
    datasetVersion: z.string().trim().min(1).max(120),
    candidate: z
      .object({
        id: z.string().trim().min(1).max(200),
        source: z.enum(['production_agent', 'codex_reference', 'other']),
        version: z.string().trim().min(1).max(200),
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            caseId: z.string().trim().min(1).max(200),
            output: z.string().max(100_000),
            toolNames: z.array(z.string().trim().min(1).max(120)).max(32),
            review: reviewSchema,
          })
          .strict(),
      )
      .max(1_000),
  })
  .strict();

export function parseSemanticEvalSubmission(
  input: unknown,
): SemanticEvalSubmission {
  return submissionSchema.parse(input);
}
