import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'docs', 'governance', 'ai-agent-enterprise-controls.json');
const allowedStatuses = new Set([
  'enforced',
  'documented',
  'evidence_pending',
  'external_action_required',
]);

function fail(messages) {
  for (const message of messages) process.stderr.write(`- ${message}\n`);
  process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const errors = [];
if (registry.schemaVersion !== 1) errors.push('schemaVersion must be 1');
if (!Array.isArray(registry.controls) || registry.controls.length === 0) {
  errors.push('controls must be a non-empty array');
}

const ids = new Set();
for (const [index, control] of (registry.controls ?? []).entries()) {
  const prefix = `controls[${index}]`;
  if (!/^[A-Z]+-\d{2}$/.test(control.id ?? '')) {
    errors.push(`${prefix}.id must match DOMAIN-NN`);
  } else if (ids.has(control.id)) {
    errors.push(`${prefix}.id is duplicated: ${control.id}`);
  }
  ids.add(control.id);
  for (const field of [
    'framework',
    'control',
    'ownerRole',
    'verification',
    'failureAction',
    'reviewCadence',
  ]) {
    if (typeof control[field] !== 'string' || !control[field].trim()) {
      errors.push(`${prefix}.${field} is required`);
    }
  }
  if (!allowedStatuses.has(control.status)) {
    errors.push(`${prefix}.status is invalid`);
  }
  if (!Array.isArray(control.evidence) || control.evidence.length === 0) {
    errors.push(`${prefix}.evidence must be non-empty`);
  }
  for (const evidence of control.evidence ?? []) {
    const evidencePath = path.resolve(root, evidence);
    if (!evidencePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(evidencePath)) {
      errors.push(`${prefix}.evidence does not exist: ${evidence}`);
    }
  }
  if (
    control.status !== 'enforced' &&
    (typeof control.nextAction !== 'string' || !control.nextAction.trim())
  ) {
    errors.push(`${prefix}.nextAction is required until enforced`);
  }
  if (typeof control.customerLaunchBlocker !== 'boolean') {
    errors.push(`${prefix}.customerLaunchBlocker must be boolean`);
  }
}

if (errors.length) fail(errors);
const counts = Object.fromEntries(
  [...allowedStatuses].map((status) => [
    status,
    registry.controls.filter((control) => control.status === status).length,
  ])
);
process.stdout.write(
  `✅ AI Agent enterprise control registry is valid: ${registry.controls.length} controls ${JSON.stringify(counts)}\n`
);
