import { spawnSync } from 'node:child_process';

const safeId = (value) =>
  typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,160}$/.test(value) ? value : null;
export function describeRevision(revision) {
  const container = revision?.spec?.containers?.[0] ?? {};
  const env = Object.fromEntries(
    (container.env ?? [])
      .filter((item) => typeof item.value === 'string')
      .map((item) => [item.name, item.value])
  );
  let endpoint = null;
  try {
    const url = new URL(env.OPENAI_BASE_URL);
    if (!url.username && !url.password && !url.search && !url.hash && url.protocol === 'https:')
      endpoint = url.origin + url.pathname;
  } catch {
    /* Unknown configuration remains unknown. */
  }
  return {
    revision: safeId(revision?.metadata?.name),
    provider: safeId(env.LLM_PROVIDER),
    model: safeId(env.OPENAI_MODEL),
    endpoint,
    harness: env.AI_AGENT_HARNESS_V1 === 'true',
    routing: env.AI_AGENT_MODEL_ROUTING_V1 === 'true',
    context: env.AI_AGENT_CONTEXT_V1 === 'true',
    approvals: env.AI_AGENT_APPROVALS_V1 === 'true',
    providerSecretBound: (container.env ?? []).some(
      (item) => item.name === 'OPENAI_API_KEY' && !!item.valueFrom?.secretKeyRef
    ),
    ready:
      revision?.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'True') === true,
  };
}
export function summarizeErrors(entries) {
  const counts = {};
  for (const entry of entries) {
    const text = JSON.stringify(entry.textPayload ?? entry.jsonPayload ?? {});
    if (!/openai|llm|provider|model/i.test(text)) continue;
    const code = /(?:authentication|invalid.api.key|\b401\b)/i.test(text)
      ? 'AUTHENTICATION'
      : /insufficient.quota|exceeded.*quota/i.test(text)
        ? 'QUOTA'
        : /\b429\b|rate.limit/i.test(text)
          ? 'RATE_LIMIT'
          : /model.*not.found|\b404\b/i.test(text)
            ? 'MODEL_OR_ENDPOINT'
            : /timeout|timed.out/i.test(text)
              ? 'TIMEOUT'
              : /\b403\b/i.test(text)
                ? 'FORBIDDEN'
                : 'OTHER_PROVIDER_ERROR';
    counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
}
export function inspectAgentRelease({ project, region, run = spawnSync }) {
  if (!safeId(project) || !safeId(region)) throw Error('INSPECTION_CONFIG_INVALID');
  const get = (args) => {
    const result = run('gcloud', [...args, `--project=${project}`, '--format=json', '--quiet'], {
      encoding: 'utf8',
      timeout: 45000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (result.status !== 0 || result.error) throw Error('READ_ONLY_GCLOUD_FAILED');
    return JSON.parse(result.stdout);
  };
  const service = get(['run', 'services', 'describe', 'study-abroad-api', `--region=${region}`]);
  const traffic = (service.status?.traffic ?? [])
    .filter((t) => t.percent > 0)
    .map((t) => ({ revision: safeId(t.revisionName), percent: t.percent }));
  const ids = [
    ...new Set([
      ...traffic.map((t) => t.revision),
      safeId(service.status?.latestCreatedRevisionName),
    ]),
  ].filter(Boolean);
  const revisions = ids.map((id) =>
    describeRevision(get(['run', 'revisions', 'describe', id, `--region=${region}`]))
  );
  let providerErrors = {},
    logInspection = 'PASS';
  try {
    providerErrors = summarizeErrors(
      get([
        'logging',
        'read',
        'resource.type="cloud_run_revision" AND resource.labels.service_name="study-abroad-api" AND severity>=ERROR',
        '--freshness=24h',
        '--limit=200',
      ])
    );
  } catch {
    logInspection = 'BLOCKED_READ_PERMISSION_OR_REQUEST';
  }
  return {
    schemaVersion: 'agent-release-inspection-v1',
    observedAt: new Date().toISOString(),
    readOnly: true,
    traffic,
    revisions,
    providerErrors,
    logInspection,
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(
      JSON.stringify(
        inspectAgentRelease({ project: process.env.GCP_PROJECT_ID, region: process.env.GCP_REGION })
      )
    );
  } catch {
    console.error('AGENT_RELEASE_INSPECTION_FAILED');
    process.exitCode = 1;
  }
}
