import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateProductionImagePolicy } from './production-image-policy.mjs';

const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../../apps/api/Dockerfile', import.meta.url), 'utf8');
test('main and authorized dispatch require scans/SBOM; inspection does not publish', () => {
  assert.deepEqual(validateProductionImagePolicy(workflow, dockerfile), []);
});
for (const [name, from, to] of [
  [
    'missing Docker dependency',
    'needs: [build, e2e, security, docker, sbom]',
    'needs: [build, e2e, security, sbom]',
  ],
  [
    'missing SBOM dependency',
    'needs: [build, e2e, security, docker, sbom]',
    'needs: [build, e2e, security, docker]',
  ],
  [
    'dispatch missing image gate',
    "if: (github.event_name == 'push' && github.ref == 'refs/heads/main') || (github.event_name == 'workflow_dispatch' && inputs.deploy == true && inputs.inspect_release != true)",
    "if: github.event_name == 'push'",
  ],
  [
    'tag substituted for deployed digest',
    'image-ref: ${{ steps.production-image.outputs.name }}@${{ steps.production-image.outputs.digest }}',
    'image-ref: image:latest',
  ],
  [
    'scan marked optional',
    '      - name: Scan production image digest before migrations\n',
    '      - name: Scan production image digest before migrations\n        continue-on-error: true\n',
  ],
  [
    'conditional scan bypass',
    '      - name: Scan production image digest before migrations\n',
    '      - name: Scan production image digest before migrations\n        if: false\n',
  ],
  ['scan exit code ignored', "exit-code: '1'", "exit-code: '0'"],
  ['severity weakened', 'severity: CRITICAL,HIGH', 'severity: CRITICAL'],
  [
    'mutable scanner action',
    'aquasecurity/trivy-action@d2a0b60797ff03db6132bd4e2b293f9b37081297',
    'aquasecurity/trivy-action@master',
  ],
  [
    'inspection allowed deployment',
    'inputs.inspect_release != true',
    'inputs.inspect_release == true',
  ],
  [
    'migration precedes digest scan',
    '- name: Verify production image provenance before deploy',
    '- name: Run database migrations',
  ],
  [
    'failure dependency bypass',
    '    needs: [build, e2e, security, docker, sbom]\n    if: ',
    '    needs: [build, e2e, security, docker, sbom]\n    if: always() && ',
  ],
]) {
  test(`rejects ${name}`, () => {
    assert.ok(workflow.includes(from));
    assert.ok(validateProductionImagePolicy(workflow.replaceAll(from, to), dockerfile).length > 0);
  });
}
for (const name of ['openssl', 'libcrypto3', 'libssl3']) {
  test(`rejects vulnerable ${name} floor in either image stage`, () => {
    const from = `'${name}>=3.5.8-r0'`;
    for (const index of [dockerfile.indexOf(from), dockerfile.lastIndexOf(from)]) {
      const modified =
        dockerfile.slice(0, index) + dockerfile.slice(index).replace(from, `'${name}>=3.5.7-r0'`);
      assert.ok(validateProductionImagePolicy(workflow, modified).length > 0);
    }
  });
}
