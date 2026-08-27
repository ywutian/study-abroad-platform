import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const releaseCondition =
  "(github.event_name == 'push' && github.ref == 'refs/heads/main') || (github.event_name == 'workflow_dispatch' && inputs.deploy == true && inputs.inspect_release != true)";

// Fail closed on edits to the deliberately small, canonical release YAML shape.
// This is a repository convention check, not a general-purpose YAML evaluator.
export function validateProductionImagePolicy(workflow, dockerfile) {
  const errors = [];
  const jobs = Object.fromEntries(
    [...workflow.matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:\n|$(?![\s\S]))/gm)].map(
      (match) => [match[1], match[2]]
    )
  );
  for (const name of ['docker', 'sbom', 'deploy-gcp']) {
    const job = jobs[name] ?? '';
    const condition = job.match(/^    if: (.+)$/m)?.[1];
    if (condition !== releaseCondition || /^    continue-on-error:/m.test(job)) {
      errors.push(`${name}: require canonical fail-closed release condition`);
    }
  }
  const deploy = jobs['deploy-gcp'] ?? '';
  const needs = deploy
    .match(/^    needs: \[([^\]]+)\]$/m)?.[1]
    .split(',')
    .map((s) => s.trim());
  if (!['build', 'e2e', 'security', 'docker', 'sbom'].every((name) => needs?.includes(name))) {
    errors.push('deploy-gcp: require successful Docker and SBOM dependencies');
  }
  for (const [jobName, stepName, image] of [
    [
      'docker',
      'Scan Docker image for vulnerabilities',
      'ghcr.io/${{ github.repository }}/api:${{ github.sha }}',
    ],
    [
      'deploy-gcp',
      'Scan production image digest before migrations',
      '${{ steps.production-image.outputs.name }}@${{ steps.production-image.outputs.digest }}',
    ],
  ]) {
    const job = jobs[jobName] ?? '';
    const step = job.split(`      - name: ${stepName}\n`)[1]?.split(/\n      - /)[0] ?? '';
    const required = [
      '        uses: aquasecurity/trivy-action@d2a0b60797ff03db6132bd4e2b293f9b37081297',
      `          image-ref: ${image}`,
      '          severity: CRITICAL,HIGH',
      "          exit-code: '1'",
      '          ignore-unfixed: true',
      "          trivyignores: '.trivyignore'",
    ];
    if (
      required.some(
        (line) =>
          !step.split('\n').some((actual) => actual === line || actual.startsWith(`${line} #`))
      ) ||
      /^\s+(if|continue-on-error|skip-files|skip-dirs|skip-version-check|limit-severities-for-sarif):/m.test(
        step
      ) ||
      /^\s+TRIVY_/m.test(step)
    ) {
      errors.push(`${jobName}: require non-optional pinned HIGH/CRITICAL image scan`);
    }
  }
  const scan = deploy.indexOf('- name: Scan production image digest before migrations');
  const provenance = deploy.indexOf('- name: Verify production image provenance before deploy');
  const migration = deploy.indexOf('- name: Run database migrations');
  if (!(provenance >= 0 && scan > provenance && migration > scan)) {
    errors.push('deploy-gcp: require verified digest scan before migrations');
  }
  const stages = dockerfile.split(/^FROM /m).slice(1);
  if (
    stages.length !== 2 ||
    stages.some(
      (stage) =>
        !/RUN apk add --no-cache --upgrade \\\n\s+'openssl>=3\.5\.8-r0' 'libcrypto3>=3\.5\.8-r0' 'libssl3>=3\.5\.8-r0'/.test(
          stage
        )
    )
  ) {
    errors.push('Dockerfile: both stages require patched OpenSSL package floors');
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateProductionImagePolicy(
    readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'),
    readFileSync(new URL('../../apps/api/Dockerfile', import.meta.url), 'utf8')
  );
  for (const error of errors) console.error(error);
  process.exitCode = errors.length ? 1 : 0;
}
