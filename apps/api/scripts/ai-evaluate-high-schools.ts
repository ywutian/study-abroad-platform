/**
 * AI-Assisted High School Evaluation Script
 *
 * Uses LLM to generate five-dimension evaluation scores for high schools
 * that lack evaluation data. Marks results as "ai-draft" for admin review.
 *
 * Usage:
 *   npx ts-node scripts/ai-evaluate-high-schools.ts [--limit=20] [--apply] [--country=CN]
 *
 * Without --apply: prints AI-generated evaluations (dry run)
 * With --apply: writes evaluations to DB with evaluatedBy="ai-draft"
 */

import { PrismaClient } from '@prisma/client';
import { computeHsQualityScore } from '@study-abroad/shared/scoring';

const prisma = new PrismaClient();

// ============================================
// Types
// ============================================

interface EvaluationResult {
  recognition: number;
  academicRigor: number;
  placementRecord: number;
  studentQuality: number;
  resources: number;
  gradeInflation: 'deflation' | 'neutral' | 'inflation';
  reasoning: string;
}

// ============================================
// LLM Call
// ============================================

async function callLLM(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Set it in .env');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `LLM API error: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? '';
}

// ============================================
// Evaluation Prompt
// ============================================

function buildEvaluationPrompt(
  schoolName: string,
  country: string,
  type: string,
  city?: string | null,
  state?: string | null,
): string {
  return `You are an expert college admissions counselor evaluating high schools for a study-abroad platform focused on US college admissions.

Evaluate the following high school on 5 dimensions (1-5 scale):

**School**: ${schoolName}
**Country**: ${country}
**Location**: ${[city, state].filter(Boolean).join(', ') || 'Unknown'}
**Type**: ${type}

## Evaluation Dimensions (each 1-5):

1. **recognition** — How well do US top-30 university admissions officers know this school?
   - 5: AOs at Ivy+ universally recognize it; active recruiting relationship
   - 4: Most top-30 AOs know it; stable application history
   - 3: Some AOs know it (depends on alumni/historical applications)
   - 2: Few AOs know it; relies on school profile
   - 1: AOs basically don't know it

2. **academicRigor** — How rigorous is the academic program?
   - 5: Known grade deflation; extremely challenging (IB avg <36, 15+ AP options)
   - 4: Rigorous curriculum, high standards (IB 36-38, many honors/AP)
   - 3: Standard difficulty, fair grading
   - 2: Easier curriculum or lenient grading
   - 1: Clear grade inflation

3. **placementRecord** — Historical college placement to top US universities?
   - 5: 10+ students to Top 20 annually
   - 4: 5-10 students to Top 30 annually
   - 3: 3-5 students to Top 50 annually
   - 2: Occasional Top 50 (1-2/year)
   - 1: Rarely Top 100

4. **studentQuality** — Competitiveness of student body?
   - 5: Extremely competitive admission (<15% acceptance, avg SAT >1500)
   - 4: Competitive (15-30%, SAT 1400-1500)
   - 3: Moderate selectivity (SAT 1300-1400)
   - 2: Light selectivity
   - 1: No entrance barrier

5. **resources** — College counseling, alumni network, AO relationships?
   - 5: Professional counseling team with direct AO relationships, strong alumni network
   - 4: Dedicated counselors, regular university visits
   - 3: Some counseling but not specialized
   - 2: Limited support
   - 1: No college counseling

Also assess **gradeInflation**: "deflation", "neutral", or "inflation"

Respond in JSON format ONLY (no markdown):
{
  "recognition": <1-5>,
  "academicRigor": <1-5>,
  "placementRecord": <1-5>,
  "studentQuality": <1-5>,
  "resources": <1-5>,
  "gradeInflation": "<deflation|neutral|inflation>",
  "reasoning": "<2-3 sentence justification>"
}`;
}

// ============================================
// Parse LLM Response
// ============================================

function parseEvaluation(response: string): EvaluationResult | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate
    const dims = [
      'recognition',
      'academicRigor',
      'placementRecord',
      'studentQuality',
      'resources',
    ] as const;
    for (const dim of dims) {
      const val = parsed[dim];
      if (typeof val !== 'number' || val < 1 || val > 5) return null;
    }

    if (
      !['deflation', 'neutral', 'inflation'].includes(parsed.gradeInflation)
    ) {
      parsed.gradeInflation = 'neutral';
    }

    return {
      recognition: Math.round(parsed.recognition),
      academicRigor: Math.round(parsed.academicRigor),
      placementRecord: Math.round(parsed.placementRecord),
      studentQuality: Math.round(parsed.studentQuality),
      resources: Math.round(parsed.resources),
      gradeInflation: parsed.gradeInflation,
      reasoning: parsed.reasoning ?? '',
    };
  } catch {
    return null;
  }
}

function computeTier(eval_: EvaluationResult): number {
  const raw =
    eval_.recognition * 0.3 +
    eval_.academicRigor * 0.25 +
    eval_.placementRecord * 0.25 +
    eval_.studentQuality * 0.1 +
    eval_.resources * 0.1;
  return Math.round(Math.max(1, Math.min(5, raw)));
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;
  const countryArg = args.find((a) => a.startsWith('--country='));
  const countryFilter = countryArg?.split('=')[1];

  console.log('🤖 AI High School Evaluator');
  console.log('='.repeat(50));
  console.log(`  Mode: ${apply ? '📝 APPLY (writing to DB)' : '👀 DRY RUN'}`);
  console.log(`  Limit: ${limit}`);
  if (countryFilter) console.log(`  Country: ${countryFilter}`);
  console.log('');

  // Find schools without evaluation
  const where: Record<string, unknown> = {
    isActive: true,
    recognition: null,
  };
  if (countryFilter) where.country = countryFilter;

  const schools = await prisma.highSchool.findMany({
    where,
    orderBy: [{ tier: 'desc' }, { name: 'asc' }],
    take: limit,
  });

  console.log(`📋 Found ${schools.length} schools needing evaluation\n`);

  let evaluated = 0;
  let failed = 0;

  for (const school of schools) {
    console.log(`\n🏫 ${school.name} (${school.country}, ${school.type})`);

    try {
      const prompt = buildEvaluationPrompt(
        school.name,
        school.country,
        school.type,
        school.city,
        school.state,
      );

      const response = await callLLM(prompt);
      const evaluation = parseEvaluation(response);

      if (!evaluation) {
        console.log(`  ❌ Failed to parse LLM response`);
        failed++;
        continue;
      }

      const tier = computeTier(evaluation);

      console.log(`  📊 Recognition: ${evaluation.recognition}/5`);
      console.log(`  📊 Academic Rigor: ${evaluation.academicRigor}/5`);
      console.log(`  📊 Placement Record: ${evaluation.placementRecord}/5`);
      console.log(`  📊 Student Quality: ${evaluation.studentQuality}/5`);
      console.log(`  📊 Resources: ${evaluation.resources}/5`);
      console.log(`  📊 Grade Inflation: ${evaluation.gradeInflation}`);
      console.log(`  🏆 Computed Tier: ${tier}/5`);
      console.log(`  💬 ${evaluation.reasoning}`);

      if (apply) {
        const quality = computeHsQualityScore({
          name: school.name,
          country: school.country,
          type: school.type,
          state: school.state,
          city: school.city,
          nameZh: (school as any).nameZh,
          tier,
          recognition: evaluation.recognition,
          academicRigor: evaluation.academicRigor,
          placementRecord: evaluation.placementRecord,
          studentQuality: evaluation.studentQuality,
          resources: evaluation.resources,
          gradeInflation: evaluation.gradeInflation,
          evaluatedBy: 'ai-draft',
          website: (school as any).website,
        });

        await prisma.highSchool.update({
          where: { id: school.id },
          data: {
            recognition: evaluation.recognition,
            academicRigor: evaluation.academicRigor,
            placementRecord: evaluation.placementRecord,
            studentQuality: evaluation.studentQuality,
            resources: evaluation.resources,
            gradeInflation: evaluation.gradeInflation,
            tier,
            qualityScore: quality.score,
            qualityGrade: quality.grade,
            hsImpactEnabled: quality.grade !== 'D',
            evaluatedAt: new Date(),
            evaluatedBy: 'ai-draft',
            evaluationNotes: `AI evaluation: ${evaluation.reasoning}`,
          },
        });
        console.log(`  ✅ Saved to database (evaluatedBy: ai-draft)`);
      }

      evaluated++;

      // Rate limit LLM calls
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.log(`  ❌ Error: ${(error as Error).message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`  ✅ Evaluated: ${evaluated}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📋 Total: ${schools.length}`);

  if (!apply && evaluated > 0) {
    console.log('\n💡 Run with --apply to save to database');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
