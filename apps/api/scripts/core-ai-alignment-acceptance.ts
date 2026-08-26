import { createHash, randomBytes } from 'node:crypto';

type JsonObject = Record<string, unknown>;

const args = new Set(process.argv.slice(2));
if (!args.has('--production')) {
  throw new Error('Refusing to run without --production');
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const apiBase = requiredEnv('CORE_AI_API_BASE').replace(/\/$/, '');
const expectedRevision = requiredEnv('CORE_AI_EXPECTED_REVISION');
const stamp = new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, '')
  .slice(0, 14);
const syntheticEmail = `core-ai-align-${stamp}@example.invalid`;
const syntheticPassword = `Alignment9!${randomBytes(8).toString('hex')}`;
let token = '';
let userId = '';
let accountDeleted = false;

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function unwrap(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as JsonObject;
  const data = record.data;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as JsonObject)
    : record;
}

async function request(
  path: string,
  options: { method?: string; body?: unknown; authenticated?: boolean } = {},
) {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...(options.authenticated === false || !token
        ? {}
        : { authorization: `Bearer ${token}` }),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  return { ok: response.ok, status: response.status, payload: unwrap(parsed) };
}

function emit(record: JsonObject): void {
  process.stdout.write(
    `${JSON.stringify({
      schemaVersion: 1,
      utc: new Date().toISOString(),
      revision: expectedRevision,
      ...record,
    })}\n`,
  );
}

function requirePass(
  condition: unknown,
  reasonCode: string,
): asserts condition {
  if (!condition) throw new Error(reasonCode);
}

function arraysForKey(value: unknown, target: string): unknown[][] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => arraysForKey(entry, target));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as JsonObject).flatMap(([key, entry]) => [
    ...(key === target && Array.isArray(entry) ? [entry] : []),
    ...arraysForKey(entry, target),
  ]);
}

function containsKey(value: unknown, target: string): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsKey(entry, target));
  }
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as JsonObject).some(
    ([key, entry]) => key === target || containsKey(entry, target),
  );
}

function asObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is JsonObject =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
      )
    : [];
}

async function deleteSyntheticAccount(): Promise<boolean> {
  if (!token || accountDeleted) return accountDeleted;
  const deletion = await request('/users/me', {
    method: 'DELETE',
    body: { password: syntheticPassword },
  });
  accountDeleted = deletion.ok && deletion.payload.success === true;
  return accountDeleted;
}

async function main(): Promise<void> {
  const registration = await request('/auth/register', {
    method: 'POST',
    authenticated: false,
    body: { email: syntheticEmail, password: syntheticPassword, locale: 'en' },
  });
  requirePass(registration.ok, `REGISTER_HTTP_${registration.status}`);
  requirePass(
    typeof registration.payload.accessToken === 'string' &&
      typeof (registration.payload.user as JsonObject | undefined)?.id ===
        'string',
    'REGISTER_CONTRACT_MISSING',
  );
  token = registration.payload.accessToken;
  userId = (registration.payload.user as JsonObject).id as string;
  emit({ scenario: 'setup', userHash: fingerprint(userId), pass: true });

  const profile = await request('/profiles/me', {
    method: 'PUT',
    body: {
      realName: 'Synthetic Applicant',
      gpa: 3.86,
      weightedGpa: 4.25,
      gpaScale: 4,
      grade: 'SENIOR',
      currentSchool: 'Synthetic Test High School',
      currentSchoolType: 'PUBLIC',
      targetMajor: 'Computer Science',
      intendedMajor: 'Computer Science',
      regionPref: ['California', 'Massachusetts', 'New York'],
      nationality: 'US',
      countryOfResidence: 'US',
      citizenship: 'US',
      needsFinancialAid: false,
      applyingTestOptional: false,
    },
  });
  const score = await request('/profiles/me/test-scores', {
    method: 'POST',
    body: { type: 'SAT', score: 1510, testDate: '2026-03-14' },
  });
  const activity = await request('/profiles/me/activities', {
    method: 'POST',
    body: {
      name: 'Synthetic Robotics Research',
      category: 'RESEARCH',
      role: 'Team Lead',
      organization: 'Synthetic Test Lab',
      description:
        'Built and evaluated an assistive robotics prototype in a controlled test fixture.',
      hoursPerWeek: 8,
      weeksPerYear: 30,
      gradeLevels: [11, 12],
      timing: 'SCHOOL_YEAR',
      isOngoing: true,
    },
  });
  requirePass(profile.ok && score.ok && activity.ok, 'PROFILE_SETUP_FAILED');

  const preflight = await request('/recommendations/preflight');
  requirePass(
    preflight.ok && preflight.payload.canGenerate === true,
    'RECOMMENDATION_PREFLIGHT_FAILED',
  );

  const generated = await request('/recommendations', {
    method: 'POST',
    body: {
      preferredRegions: ['California', 'Massachusetts', 'New York'],
      preferredMajors: ['Computer Science'],
      budget: 'unlimited',
      schoolCount: 5,
      additionalPreferences:
        'Use official institutional facts and the current prediction engine; do not use historical admission cases.',
    },
  });
  requirePass(generated.ok, `RECOMMENDATION_HTTP_${generated.status}`);
  const recommendationId = generated.payload.id;
  const recommendations = asObjects(generated.payload.recommendations);
  requirePass(
    typeof recommendationId === 'string',
    'RECOMMENDATION_ID_MISSING',
  );
  requirePass(recommendations.length > 0, 'RECOMMENDATION_EMPTY');
  requirePass(
    recommendations.every(
      (school) =>
        typeof school.schoolId === 'string' &&
        ['reach', 'match', 'safety'].includes(String(school.tier)) &&
        Number.isFinite(school.estimatedProbability) &&
        Number(school.estimatedProbability) >= 0 &&
        Number(school.estimatedProbability) <= 100,
    ),
    'RECOMMENDATION_PREDICTION_CONTRACT_FAILED',
  );
  requirePass(
    !containsKey(generated.payload, 'caseComparison'),
    'CASE_DATA_LEAK',
  );

  const school = recommendations[0];
  const schoolId = school.schoolId as string;
  const metricsBefore = await request(
    `/recommendations/${encodeURIComponent(recommendationId)}/metrics`,
  );
  const countsBefore = metricsBefore.payload.counts as JsonObject | undefined;
  const ratesBefore = metricsBefore.payload.rates as JsonObject | undefined;
  requirePass(
    metricsBefore.ok &&
      metricsBefore.payload.insufficientSample === true &&
      Number(countsBefore?.impressions) === recommendations.length &&
      ratesBefore?.addRate === null &&
      ratesBefore?.retentionRate === null &&
      ratesBefore?.applicationConversionRate === null,
    'LOW_SAMPLE_METRICS_FAILED',
  );
  emit({
    scenario: 'case_independent_school_selection',
    recommendationCount: recommendations.length,
    predictedCount: recommendations.length,
    impressionCount: Number(countsBefore?.impressions),
    lowSampleSuppressed: true,
    pass: true,
  });

  const tier =
    school.tier === 'reach'
      ? 'REACH'
      : school.tier === 'safety'
        ? 'SAFETY'
        : 'TARGET';
  const listItem = await request('/school-lists', {
    method: 'POST',
    body: {
      schoolId,
      tier,
      round: 'RD',
      isAIRecommended: true,
      recommendationId,
    },
  });
  requirePass(listItem.ok, `SCHOOL_LIST_HTTP_${listItem.status}`);

  const timeline = await request('/timelines', {
    method: 'POST',
    body: { schoolId, round: 'RD', applicationYear: 2027 },
  });
  requirePass(timeline.ok, `TIMELINE_CREATE_HTTP_${timeline.status}`);
  requirePass(typeof timeline.payload.id === 'string', 'TIMELINE_ID_MISSING');
  const submitted = await request(
    `/timelines/${encodeURIComponent(timeline.payload.id)}`,
    { method: 'PUT', body: { status: 'SUBMITTED', progress: 100 } },
  );
  requirePass(submitted.ok, `TIMELINE_SUBMIT_HTTP_${submitted.status}`);

  const metricsAfter = await request(
    `/recommendations/${encodeURIComponent(recommendationId)}/metrics`,
  );
  const countsAfter = metricsAfter.payload.counts as JsonObject | undefined;
  requirePass(
    metricsAfter.ok &&
      Number(countsAfter?.added) === 1 &&
      Number(countsAfter?.retained) === 1 &&
      Number(countsAfter?.applied) === 1,
    'OUTCOME_ATTRIBUTION_FAILED',
  );
  emit({
    scenario: 'recommendation_outcome_attribution',
    added: Number(countsAfter?.added),
    retained: Number(countsAfter?.retained),
    applied: Number(countsAfter?.applied),
    pass: true,
  });

  const analysis = await request('/profiles/me/ai-analysis');
  requirePass(analysis.ok, `APPLICATION_ANALYSIS_HTTP_${analysis.status}`);
  const historicalSignals = arraysForKey(analysis.payload, 'historicalSignals');
  const cards = asObjects(
    analysis.payload.schoolCards ?? analysis.payload.targetSchoolInsights,
  );
  const predictionCount = cards.filter(
    (card) => card.prediction || card.predictionSnapshot,
  ).length;
  const policyCount = cards.filter(
    (card) => card.policyCard || card.policyContext,
  ).length;
  requirePass(cards.length > 0, 'APPLICATION_ANALYSIS_SCHOOLS_MISSING');
  requirePass(
    historicalSignals.every((signals) => signals.length === 0),
    'APPLICATION_ANALYSIS_CASE_SIGNAL_LEAK',
  );
  requirePass(predictionCount > 0, 'APPLICATION_ANALYSIS_PREDICTION_MISSING');
  requirePass(policyCount > 0, 'APPLICATION_ANALYSIS_POLICY_MISSING');
  emit({
    scenario: 'case_independent_application_analysis',
    schoolCount: cards.length,
    predictionCount,
    policyCount,
    historicalSignalArrays: historicalSignals.length,
    nonEmptyHistoricalSignalArrays: 0,
    pass: true,
  });

  requirePass(await deleteSyntheticAccount(), 'SYNTHETIC_CLEANUP_FAILED');
  const loginAfterDeletion = await request('/auth/login', {
    method: 'POST',
    authenticated: false,
    body: { email: syntheticEmail, password: syntheticPassword },
  });
  const cleanupPass = !loginAfterDeletion.ok;
  requirePass(cleanupPass, 'SYNTHETIC_ACCOUNT_STILL_ACTIVE');
  emit({
    scenario: 'cleanup',
    accountSoftDeleted: true,
    loginRejected: true,
    pass: true,
  });
  emit({
    scenario: 'summary',
    scenarios: 5,
    pass: true,
    reasonCodes: [],
  });
}

main()
  .catch((error: unknown) => {
    emit({
      scenario: 'summary',
      pass: false,
      reasonCodes: [error instanceof Error ? error.message : 'UNKNOWN_FAILURE'],
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!accountDeleted && token) {
      const cleaned = await deleteSyntheticAccount().catch(() => false);
      emit({
        scenario: 'cleanup',
        accountSoftDeleted: cleaned,
        loginRejected: false,
        pass: false,
        reasonCode: cleaned
          ? 'CLEANED_AFTER_SCENARIO_FAILURE'
          : 'SYNTHETIC_CLEANUP_FAILED',
      });
      if (!cleaned) process.exitCode = 1;
    }
  });
