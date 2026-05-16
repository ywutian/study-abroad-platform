import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type StepResult = {
  name: string;
  status: 'PASS' | 'FAIL';
  detail: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
} & T;

export type SmokeCliOptions = {
  baseUrl: string;
  schoolQuery: string;
  round: string;
};

function parseArgs(argv: string[]): SmokeCliOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  return {
    baseUrl: values.get('base-url') ?? 'http://localhost:4101/api/v1',
    schoolQuery: values.get('school-query') ?? 'Wisconsin',
    round: values.get('round') ?? 'EA',
  };
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
    return payload.data;
  }
  return payload as unknown as T;
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  token?: string
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : ({} as ApiEnvelope<T>);

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} on ${path}: ${
        typeof parsed === 'object' ? JSON.stringify(parsed) : raw
      }`
    );
  }

  return unwrap(parsed);
}

export type SmokeReport = {
  passed: boolean;
  results: StepResult[];
};

export async function runPredictionStabilitySmoke(
  partialOptions: Partial<SmokeCliOptions> = {}
): Promise<SmokeReport> {
  const options: SmokeCliOptions = {
    baseUrl: partialOptions.baseUrl ?? 'http://localhost:4101/api/v1',
    schoolQuery: partialOptions.schoolQuery ?? 'Wisconsin',
    round: partialOptions.round ?? 'EA',
  };
  const results: StepResult[] = [];

  function record(name: string, status: StepResult['status'], detail: string) {
    results.push({ name, status, detail });
  }

  try {
    const schoolSearch = await request<{
      items: Array<{ id: string; name: string }>;
    }>(
      options.baseUrl,
      `/schools?search=${encodeURIComponent(options.schoolQuery)}&page=1&pageSize=5`,
      { method: 'GET' }
    );
    const school = schoolSearch.items[0];
    if (!school) throw new Error(`No school found for query "${options.schoolQuery}"`);
    record('school_lookup', 'PASS', `${school.name} (${school.id})`);

    const email = `prediction.smoke.${Date.now()}@example.com`;
    const register = await request<{
      accessToken: string;
    }>(options.baseUrl, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'Password123!',
        locale: 'en',
      }),
    });
    record('register', 'PASS', email);

    const token = register.accessToken;

    await request(
      options.baseUrl,
      '/profiles/me',
      {
        method: 'PUT',
        body: JSON.stringify({
          gpa: 3.94,
          gpaScale: 4.0,
          targetMajor: 'Computer Science',
          intendedMajor: 'Computer Science',
          applicationRound: options.round,
          nationality: 'CN',
          countryOfResidence: 'CN',
          citizenship: 'CN',
          educationSystem: 'AP',
        }),
      },
      token
    );
    record('profile_update', 'PASS', `round=${options.round}`);

    for (const score of [
      { type: 'SAT', score: 1540 },
      { type: 'TOEFL', score: 110 },
    ]) {
      await request(
        options.baseUrl,
        '/profiles/me/test-scores',
        {
          method: 'POST',
          body: JSON.stringify(score),
        },
        token
      );
    }
    record('test_scores', 'PASS', 'SAT + TOEFL');

    // 2026-05 Phase 1 Bug 1: predictions now require schoolIds ∈ user's
    // SchoolListItem (invariant I2 — see
    // docs/architecture/dashboard-invariants.md). The smoke test must
    // add the school to the user's list before calling /predictions,
    // otherwise the request fails with 400 PREDICTION_INVALID_SCHOOL_IDS.
    await request(
      options.baseUrl,
      '/school-lists',
      {
        method: 'POST',
        body: JSON.stringify({
          schoolId: school.id,
          tier: 'TARGET',
          round: options.round,
        }),
      },
      token
    );
    record('school_list_add', 'PASS', `${school.name} (${options.round})`);

    const prediction = await request<{
      results: Array<{
        schoolId: string;
        probability: number;
        roundContext?: string;
        servedPolicyVersionId?: string;
      }>;
    }>(
      options.baseUrl,
      '/predictions',
      {
        method: 'POST',
        body: JSON.stringify({
          schoolIds: [school.id],
          forceRefresh: true,
        }),
      },
      token
    );

    const firstResult = prediction.results[0];
    if (!firstResult) throw new Error('Prediction returned no results');
    if (firstResult.roundContext !== options.round) {
      throw new Error(
        `Expected roundContext=${options.round}, got ${String(firstResult.roundContext)}`
      );
    }
    if (!(firstResult.probability > 0 && firstResult.probability < 1)) {
      throw new Error(`Invalid probability ${String(firstResult.probability)}`);
    }
    if (!firstResult.servedPolicyVersionId) {
      throw new Error('Prediction result is missing servedPolicyVersionId');
    }
    record(
      'predict',
      'PASS',
      `probability=${firstResult.probability.toFixed(4)}, roundContext=${firstResult.roundContext}, policy=${firstResult.servedPolicyVersionId}`
    );

    const dashboard = await request<{
      totalSchools: number;
      predictions: Array<{
        schoolId: string;
        roundContext?: string;
        servedPolicyVersionId?: string;
      }>;
    }>(options.baseUrl, '/predictions/dashboard', { method: 'GET' }, token);

    const dashboardPrediction = dashboard.predictions.find((item) => item.schoolId === school.id);
    if (!dashboardPrediction) {
      throw new Error('Dashboard is missing the persisted prediction');
    }
    if (!dashboardPrediction.servedPolicyVersionId) {
      throw new Error('Dashboard prediction is missing servedPolicyVersionId');
    }
    record(
      'dashboard_persist',
      'PASS',
      `totalSchools=${dashboard.totalSchools}, roundContext=${dashboardPrediction.roundContext ?? 'n/a'}, policy=${dashboardPrediction.servedPolicyVersionId}`
    );

    await request(
      options.baseUrl,
      `/predictions/${school.id}/result`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          result: 'ADMITTED',
          notes: 'prediction stability smoke',
          round: options.round,
          isFinal: false,
        }),
      },
      token
    );
    record('report_result', 'PASS', 'SELF_REPORTED outcome accepted');

    const history = await request<{
      items: Array<{
        schoolId: string;
        servedPolicyVersionId?: string;
        latestOutcomeLabel?: { result: string; status: string; round?: string };
      }>;
    }>(options.baseUrl, '/predictions/history?page=1&pageSize=5', { method: 'GET' }, token);

    const historyItem = history.items.find((item) => item.schoolId === school.id);
    if (!historyItem?.latestOutcomeLabel) {
      throw new Error('Prediction history is missing latestOutcomeLabel after report');
    }
    if (!historyItem.servedPolicyVersionId) {
      throw new Error('Prediction history is missing servedPolicyVersionId');
    }
    record(
      'history_outcome',
      'PASS',
      `${historyItem.latestOutcomeLabel.result}/${historyItem.latestOutcomeLabel.status} (${historyItem.servedPolicyVersionId})`
    );
  } catch (error) {
    record('smoke', 'FAIL', error instanceof Error ? error.message : String(error));
  }

  return {
    passed: !results.some((result) => result.status === 'FAIL'),
    results,
  };
}

export function renderPredictionStabilitySmoke(report: SmokeReport): string {
  const lines = ['Prediction Stability Smoke'];
  for (const result of report.results) {
    lines.push(`- [${result.status}] ${result.name}: ${result.detail}`);
  }
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await runPredictionStabilitySmoke(options);

  console.log(renderPredictionStabilitySmoke(report));

  if (!report.passed) {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  main().catch((error) => {
    console.error(
      '[prediction-stability-smoke] failed:',
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  });
}
