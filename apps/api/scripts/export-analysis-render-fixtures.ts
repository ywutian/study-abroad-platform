import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ConfigService } from '@nestjs/config';
import type { ApplicationAnalysisRenderFixture } from '@study-abroad/shared';

import { LLMService } from '../src/modules/ai-agent/core/llm.service';
import { OpenAIProvider } from '../src/modules/ai-agent/providers/openai.provider';
import type { ApplicationAnalysisResponseV2 } from '../src/modules/ai/ai.types';
import type { AnalysisSnapshot } from '../src/modules/profile/profile-application-analysis-v2.service';
import { ProfileApplicationAnalysisV2Service } from '../src/modules/profile/profile-application-analysis-v2.service';
import type { GoldCase } from '../gold-cases/schema';

const GOLD_CASES_DIR = path.resolve(__dirname, '../gold-cases/cases');
const OUTPUT_FILE = path.resolve(
  __dirname,
  '../../../packages/shared/src/fixtures/application-analysis-render.data.ts',
);

function ensureEnvDefaults() {
  process.env.NODE_ENV ??= 'test';
  process.env.JWT_SECRET ??= 'render-fixtures-jwt-secret';
  process.env.JWT_REFRESH_SECRET ??= 'render-fixtures-refresh-secret';
  process.env.JWT_EXPIRES_IN ??= '15m';
  process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
}

function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => reviveDates(entry)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, reviveDates(entry)]),
    ) as T;
  }
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
  ) {
    return new Date(value) as T;
  }
  return value;
}

async function loadGoldCases() {
  const files = (await readdir(GOLD_CASES_DIR))
    .filter((file) => file.endsWith('.json'))
    .sort();

  const cases = await Promise.all(
    files.map(async (file) => {
      const contents = await readFile(path.join(GOLD_CASES_DIR, file), 'utf8');
      return JSON.parse(contents) as GoldCase;
    }),
  );

  return cases.filter((goldCase) => goldCase.tags.includes('render-smoke'));
}

function buildExpectedSections(analysis: ApplicationAnalysisResponseV2) {
  const sections: ApplicationAnalysisRenderFixture['expectedSections'] = [
    'profileContext',
    'schoolListDiagnosis',
    'focusSchools',
    'actionPlan',
  ];

  if (analysis.unknowns.length > 0) {
    sections.push('unknowns');
  }

  if (analysis.meta.runId) {
    sections.push('feedback');
  }

  return sections;
}

function buildForbiddenKeywords(goldCase: GoldCase) {
  return [
    ...new Set(
      goldCase.expected.schoolCards.flatMap((school) => [
        ...(school.forbidden?.fieldInSummary ?? []),
        ...(school.forbidden?.invalidActionKeywords ?? []),
      ]),
    ),
  ];
}

async function main() {
  ensureEnvDefaults();
  const goldCases = await loadGoldCases();
  const configService = new ConfigService(process.env);
  const llmService = new LLMService(
    configService,
    new OpenAIProvider(configService),
  );
  const analysisService = new ProfileApplicationAnalysisV2Service(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    llmService,
    {} as never,
  );

  const fixtures: ApplicationAnalysisRenderFixture[] = [];

  for (const goldCase of goldCases) {
    const snapshot = reviveDates(goldCase.analysisSnapshot) as AnalysisSnapshot;
    const analysis = await analysisService.runSnapshot(snapshot, {
      debug: true,
      mode: 'deterministic',
      persistRun: false,
    });

    fixtures.push({
      caseId: goldCase.id,
      locale: goldCase.inputConfig.locale,
      tags: goldCase.tags,
      analysis,
      expectedSections: buildExpectedSections(analysis),
      expectedSchoolOrder: analysis.schoolCards.map(
        (school) => school.schoolName,
      ),
      forbiddenKeywords: buildForbiddenKeywords(goldCase),
      maskSelectors: [
        '[data-testid="analysis-trace-id"]',
        '[data-testid^="analysis-school-updated-at-"]',
        // This file is REGENERATED on every nightly run (the workflow's
        // "Generate render fixtures" step), so anything derived from the
        // generation date differs from the committed baseline every single
        // day. freshnessSummary.summary embeds it as prose — "…analysis from
        // 2026-04-21." — and it is the only date-bearing field that reaches
        // the DOM unmasked (meta.generatedAt and freshnessSummary.generatedAt
        // are never rendered; prediction.updatedAt is covered by the selector
        // above). A timestamp cannot be pixel-compared; mask it.
        '[data-testid="analysis-freshness-summary"]',
      ],
    });
  }

  const fileContents = [
    "import type { ApplicationAnalysisRenderFixture } from '../types/application-analysis-render';",
    '',
    'export const applicationAnalysisRenderFixtureData: ApplicationAnalysisRenderFixture[] = ',
    `${JSON.stringify(fixtures, null, 2)};`,
    '',
  ].join('\n');

  await writeFile(`${OUTPUT_FILE}`, fileContents, 'utf8');
  console.log(
    JSON.stringify(
      {
        status: 'ok',
        output: path.relative(process.cwd(), OUTPUT_FILE),
        fixtures: fixtures.length,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
