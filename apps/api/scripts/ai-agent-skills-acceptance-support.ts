import type { JsonRecord } from './ai-agent-harness-acceptance-support';

interface AcceptanceResponse {
  ok: boolean;
  status: number;
  payload: JsonRecord | null;
}

interface AcceptanceIo {
  request: (
    path: string,
    options?: {
      method?: string;
      body?: unknown;
      auth?: 'admin' | 'synthetic' | 'none';
    },
  ) => Promise<AcceptanceResponse>;
  emit: (record: JsonRecord) => void;
}

export async function verifyDeclarativeSkills({
  request,
  emit,
}: AcceptanceIo): Promise<boolean> {
  const skillStatus = await request('/admin/ai-agent/skills', {
    auth: 'admin',
  });
  const deployments = Array.isArray(skillStatus.payload?.deployments)
    ? skillStatus.payload.deployments
    : [];
  const safeValidation = await request('/admin/ai-agent/skills/validate', {
    method: 'POST',
    auth: 'admin',
    body: {
      agentType: 'school',
      reason: 'Synthetic validation only',
      patch: {
        instructions: {
          en: ['Use only verified tool evidence in this synthetic validation.'],
        },
      },
    },
  });
  const unsafeValidation = await request('/admin/ai-agent/skills/validate', {
    method: 'POST',
    auth: 'admin',
    body: {
      agentType: 'essay',
      reason: 'Synthetic rejection validation only',
      patch: { allowedTools: ['web_search'] },
    },
  });
  const legacyCredential = await request('/auth/login', {
    method: 'POST',
    auth: 'none',
    body: {
      email: 'admin@example.com',
      password: ['Admin', '123!'].join(''),
    },
  });
  const passed =
    skillStatus.ok &&
    skillStatus.payload?.enabled === true &&
    skillStatus.payload?.evolutionEnabled === true &&
    skillStatus.payload?.autoPublishEnabled === true &&
    deployments.length === 6 &&
    deployments.every(
      (deployment: JsonRecord) =>
        typeof deployment.activeVersionId === 'string' &&
        deployment.activeVersionId.length > 0,
    ) &&
    safeValidation.ok &&
    safeValidation.payload?.valid === true &&
    unsafeValidation.status === 400 &&
    legacyCredential.status === 401;
  emit({
    scenario: 'declarative_skills_boundary',
    http: skillStatus.status,
    deploymentCount: deployments.length,
    autoPublishEnabled: skillStatus.payload?.autoPublishEnabled === true,
    safeCandidateAccepted: safeValidation.ok,
    permissionExpansionRejected: unsafeValidation.status === 400,
    legacyCredentialRejected: legacyCredential.status === 401,
    pass: passed,
    reasonCode: passed
      ? 'SKILL_BOUNDARY_AND_DEPLOYMENTS_CONFIRMED'
      : 'SKILL_BOUNDARY_FAILED',
  });
  return passed;
}

export async function verifySkillVersionPin(
  io: AcceptanceIo,
  runId: string,
): Promise<boolean> {
  const pinnedRun = runId
    ? await io.request(`/ai-agent/runs/${runId}`)
    : { ok: false, status: 0, payload: null };
  const passed =
    pinnedRun.ok &&
    typeof pinnedRun.payload?.skillVersionId === 'string' &&
    pinnedRun.payload.skillVersionId.length > 0;
  io.emit({
    scenario: 'skill_version_pinning',
    http: pinnedRun.status,
    runStatus: pinnedRun.payload?.status,
    versionPinned: passed,
    pass: passed,
    reasonCode: passed
      ? 'RUN_SKILL_VERSION_IMMUTABLY_PINNED'
      : 'RUN_SKILL_VERSION_NOT_PINNED',
  });
  return passed;
}
