import { z } from 'zod';
import type { ToolExecutorService } from './tool-executor.service';
import type { ConversationState } from '../types';

export function buildVerificationPrompt(
  solveOutput: string,
  locale: string,
): string {
  return locale === 'en'
    ? `Extract up to 5 verifiable factual claims from this college admissions response.
Only include claims that can be checked against a school database (acceptance rates, rankings, deadlines, tuition).
Skip subjective opinions or advice.

Response:
${solveOutput.slice(0, 2000)}

Reply in JSON: {"facts": [{"claim": "MIT has a 3.4% acceptance rate", "schoolName": "MIT", "field": "acceptanceRate"}]}`
    : `从以下留学申请回复中提取最多 5 个可验证的事实性声明。
只包含可以通过学校数据库验证的声明（录取率、排名、截止日期、学费）。
跳过主观建议。

回复：
${solveOutput.slice(0, 2000)}

用 JSON 回复：{"facts": [{"claim": "MIT 录取率 3.4%", "schoolName": "MIT", "field": "acceptanceRate"}]}`;
}

const factsSchema = z
  .object({
    facts: z
      .array(
        z
          .object({
            claim: z.string().trim().min(1).max(500),
            schoolName: z.string().trim().min(1).max(200),
            field: z
              .string()
              .regex(/^[a-zA-Z][a-zA-Z0-9]{0,63}$/)
              .refine((value) => !['constructor', 'prototype'].includes(value)),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();
export function parseVerificationFacts(value: unknown) {
  const parsed = factsSchema.safeParse(value);
  return parsed.success ? parsed.data.facts : undefined;
}

/** Do not equate missing data, dates or ambiguous units with a checked fact. */
export function compareVerificationNumber(
  claim: string,
  actual: unknown,
): 'verified' | 'conflict' | 'unverified' {
  if (
    /(?:\bnot\b|\bat least\b|\bat most\b|\bmore than\b|\bless than\b|不是|不等于|至少|至多|高于|低于|超过|不到|[<>≤≥]|-\d)/i.test(
      claim,
    )
  )
    return 'unverified';
  if (typeof actual !== 'number' && typeof actual !== 'string')
    return 'unverified';
  const expected = String(actual).trim();
  if (!/^\d+(?:\.\d+)?%?$/.test(expected)) return 'unverified';
  const numbers = claim.match(/\d+(?:\.\d+)?%?/g);
  if (numbers?.length !== 1) return 'unverified';
  const value = numbers[0];
  // A percentage versus a ratio may be a unit mismatch; do not invent a verdict.
  if (value.endsWith('%') !== expected.endsWith('%')) return 'unverified';
  return Number.parseFloat(value) === Number.parseFloat(expected)
    ? 'verified'
    : 'conflict';
}

export function verificationStatus(
  verified: number,
  conflicts: number,
  unverified: number,
): 'verified' | 'conflict' | 'unverified' | 'not_applicable' {
  if (conflicts > 0) return 'conflict';
  if (unverified > 0) return 'unverified';
  return verified > 0 ? 'verified' : 'not_applicable';
}

/** Adapt the school tool's sourced-percent contract without guessing units. */
function comparableSchoolValue(actual: unknown): unknown {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual))
    return actual;
  const fact = actual as Record<string, unknown>;
  if (
    !fact.source ||
    typeof fact.source !== 'object' ||
    Array.isArray(fact.source)
  )
    return undefined;
  const source = fact.source as Record<string, unknown>;
  if (
    fact.consumerPolicy !== 'use_with_field_source' ||
    source.isVerified !== true ||
    (source.staleness !== 'FRESH' && source.staleness !== 'AGING') ||
    typeof fact.value !== 'number' ||
    !Number.isFinite(fact.value) ||
    fact.value < 0 ||
    fact.value > 100 ||
    fact.displayValue !== `${fact.value}%`
  )
    return undefined;
  return fact.displayValue;
}

/** Read-only fact lookup; missing fields and failed lookups remain unknown. */
export async function verifySchoolFacts(
  facts: z.infer<typeof factsSchema>['facts'],
  executor: Pick<ToolExecutorService, 'execute'>,
  conversation: ConversationState,
  locale: string,
  remainingToolCalls: number,
) {
  const corrections: Array<{ claim: string; actual: string; tool: string }> =
    [];
  let verified = 0;
  let toolCalls = 0;
  const limit = Math.max(0, Math.min(5, remainingToolCalls));
  let unverified = Math.max(0, facts.length - limit);
  await Promise.allSettled(
    facts.slice(0, limit).map(async (fact) => {
      try {
        toolCalls++;
        const result = await executor.execute(
          {
            id: `cove_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: 'get_school_details',
            arguments: { schoolName: fact.schoolName },
          },
          conversation.userId,
          conversation.context,
          locale,
        );
        if (!result.success || !result.result) {
          unverified++;
          return;
        }
        const value = comparableSchoolValue(
          (result.result as Record<string, unknown>)[fact.field],
        );
        const verdict = compareVerificationNumber(fact.claim, value);
        if (verdict === 'unverified') {
          unverified++;
          return;
        }
        if (verdict === 'conflict') {
          corrections.push({
            claim: fact.claim,
            actual: `${fact.field}: ${String(value)}`,
            tool: 'get_school_details',
          });
          return;
        }
        verified++;
      } catch {
        unverified++;
      }
    }),
  );
  return {
    allCorrect: verified > 0 && corrections.length === 0 && unverified === 0,
    status: verificationStatus(verified, corrections.length, unverified),
    unverified,
    verified,
    toolCalls,
    corrections,
  };
}
