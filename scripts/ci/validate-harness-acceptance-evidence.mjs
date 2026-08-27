import fs from 'node:fs';

const SAFE_FIELDS = new Set([
  'utc',
  'revision',
  'scenario',
  'http',
  'runStatus',
  'approvalStatus',
  'approvalFingerprint',
  'userHash',
  'metric',
  'metricBefore',
  'metricAfter',
  'attempts',
  'previousSummaryHash',
  'retainedSummaryHash',
  'summaryHash',
  'messageCount',
  'memoriesBefore',
  'memoriesAfter',
  'entitiesBefore',
  'entitiesAfter',
  'deploymentCount',
  'autoPublishEnabled',
  'alertPersisted',
  'alertAcknowledged',
  'safeCandidateAccepted',
  'permissionExpansionRejected',
  'legacyCredentialRejected',
  'versionPinned',
  'eventDeleted',
  'aiDataCleared',
  'accountSoftDeleted',
  'sideEffectCount',
  'requestAttempts',
  'tokenMetricDelta',
  'durationMetricDelta',
  'reason',
  'pass',
  'reasonCode',
  'singleVector',
  'batchVectors',
  'cacheConsistent',
  'vectorStored',
  'semanticRecall',
  'semanticOrdering',
  'userIsolation',
  'fallbackStored',
  'fallbackRecall',
  'fixtureCleanup',
  'isolationAccountCleaned',
]);

const REQUIRED_SCENARIOS = [
  'declarative_skills_boundary',
  'skill_version_pinning',
  'memory_disabled',
  'context_compression',
  'context_compression_fallback',
  'approval_disconnect_recovery',
  'budget_exhaustion',
  'cleanup',
  'embedding_memory',
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--input' || key === '--output' || key === '--revision') {
      args[key.slice(2)] = value;
      index += 1;
    }
  }
  return args;
}

function pickSafeFields(record) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => SAFE_FIELDS.has(key)));
}

export function validateHarnessEvidence({ text, expectedRevision }) {
  const records = [];
  const errors = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      errors.push(`line_${index + 1}_not_json`);
      continue;
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`line_${index + 1}_not_record`);
      continue;
    }
    const unknownFields = Object.keys(record).filter((key) => !SAFE_FIELDS.has(key));
    if (unknownFields.length > 0) {
      errors.push(`line_${index + 1}_unsafe_fields`);
      continue;
    }
    if (record.revision !== expectedRevision) {
      errors.push(`line_${index + 1}_revision_mismatch`);
    }
    records.push(pickSafeFields(record));
  }

  const byScenario = new Map();
  for (const record of records) {
    const scenario = typeof record.scenario === 'string' ? record.scenario : '';
    if (scenario) byScenario.set(scenario, (byScenario.get(scenario) ?? 0) + 1);
  }
  for (const scenario of REQUIRED_SCENARIOS) {
    if (byScenario.get(scenario) !== 1) {
      errors.push(`scenario_${scenario}_missing_or_duplicate`);
    }
  }
  for (const record of records) {
    if (
      record.scenario === 'embedding_memory' &&
      [
        'singleVector',
        'batchVectors',
        'cacheConsistent',
        'vectorStored',
        'semanticRecall',
        'semanticOrdering',
        'userIsolation',
        'fallbackStored',
        'fallbackRecall',
        'fixtureCleanup',
        'isolationAccountCleaned',
      ].some((key) => record[key] !== true)
    ) {
      errors.push('scenario_embedding_memory_incomplete');
    }
    if (
      REQUIRED_SCENARIOS.includes(record.scenario) &&
      record.scenario !== 'setup' &&
      record.pass !== true
    ) {
      errors.push(`scenario_${record.scenario}_failed`);
    }
  }
  return { ok: errors.length === 0, errors, records };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input ?? process.env.HARNESS_EVIDENCE_INPUT;
  const output = args.output ?? process.env.HARNESS_EVIDENCE_OUTPUT;
  const expectedRevision = args.revision ?? process.env.HARNESS_EXPECTED_REVISION;
  if (!input || !output || !expectedRevision) {
    console.error('Missing --input, --output, or --revision');
    process.exit(2);
  }
  const result = validateHarnessEvidence({
    text: fs.readFileSync(input, 'utf8'),
    expectedRevision,
  });
  // The artifact contains only the allowlisted fields above. Never copy the
  // runner's stderr or an unvalidated line into an artifact.
  fs.writeFileSync(
    output,
    `${JSON.stringify({
      schemaVersion: 'ai-agent-harness-acceptance-v1',
      revision: expectedRevision,
      records: result.records,
      pass: result.ok,
      reasonCodes: result.errors,
    })}\n`,
    'utf8'
  );
  if (!result.ok) {
    for (const error of result.errors) console.error(`::error::${error}`);
    process.exit(1);
  }
  console.log(
    `Harness acceptance evidence passed: ${result.records.length} sanitized records for ${expectedRevision}`
  );
}
