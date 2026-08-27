import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  analysisSchema,
  parseAnalysisSegment,
} from './analysis-segments.contract';

const resultSchema = z
  .object({
    schoolId: z.string().min(1).max(160),
    analysis: analysisSchema('analysis.school', 'complete'),
  })
  .strict();
export const sharedSchoolSchema = z
  .object({
    schools: z.array(resultSchema).min(1).max(2),
  })
  .strict();

export function sharedSchoolResponseFormat() {
  const { type, json_schema } = zodResponseFormat(
    sharedSchoolSchema,
    'analysis_school_shared',
  );
  return { type, json_schema };
}

export function parseSharedSchools(
  content: string,
  inputs: readonly Record<string, unknown>[],
): Map<string, Record<string, unknown>> | undefined {
  try {
    const parsed = sharedSchoolSchema.safeParse(JSON.parse(content));
    if (!parsed.success || parsed.data.schools.length !== inputs.length) return;
    const results = new Map<string, Record<string, unknown>>();
    for (const item of parsed.data.schools) {
      const input = inputs.find((value) => value.schoolId === item.schoolId);
      if (
        !input ||
        results.has(item.schoolId) ||
        !Array.isArray(input.allowedEvidenceIds)
      )
        return;
      const allowed = input.allowedEvidenceIds.filter(
        (id): id is string => typeof id === 'string',
      );
      const analysis = parseAnalysisSegment(
        'analysis.school',
        'complete',
        JSON.stringify(item.analysis),
        allowed,
      );
      if (!analysis) return;
      results.set(item.schoolId, analysis);
    }
    return results;
  } catch {
    return;
  }
}
