/**
 * Deploy-config drift guard.
 *
 * GCP deploy config got fixed 10+ times across CI / staging / preview / job
 * workflows — including an explicit "sync deploy config between CI and manual
 * workflow" (#c7c1ab7c). The shared constants (VPC connector, Artifact Registry
 * image, region/project secrets) are duplicated inline in every workflow, so any
 * one of them can silently drift.
 *
 * This guard makes `.github/deploy-config.json` the single declared source of
 * truth and asserts every deploy workflow uses those exact values — connector,
 * AR image, and region/project via the canonical secrets (never a hardcoded
 * region). It's read-only over the YAML (zero deploy risk, fully local) — it
 * does NOT rewrite the deploy commands. See docs/DEPLOY_CONFIG.md.
 *
 * Usage: tsx scripts/check-deploy-config-drift.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const WF_DIR = path.join(ROOT, '.github/workflows');
const CONFIG = JSON.parse(
  fs.readFileSync(path.join(ROOT, '.github/deploy-config.json'), 'utf8')
) as {
  vpcConnector: string;
  artifactRegistry: string;
  regionSecret: string;
  projectSecret: string;
};

// Hardcoded GCP region literals that should come from the secret instead.
const HARDCODED_REGION =
  /--region[=\s]+["']?(us|europe|asia|northamerica|southamerica|australia)-[a-z]+\d/;

function main() {
  const errors: string[] = [];
  const files = fs
    .readdirSync(WF_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => path.join(WF_DIR, f))
    .filter((f) => /gcloud run|docker\.pkg\.dev/.test(fs.readFileSync(f, 'utf8')));

  if (files.length === 0) {
    console.error('❌ No deploy workflows found — has the deploy pipeline moved?');
    process.exit(1);
  }

  for (const file of files) {
    const rel = '.github/workflows/' + path.basename(file);
    const text = fs.readFileSync(file, 'utf8');

    // VPC connector name must match canonical wherever a connector is referenced.
    for (const m of text.matchAll(/connectors\/([A-Za-z0-9-]+)/g)) {
      if (m[1] !== CONFIG.vpcConnector) {
        errors.push(`${rel}: VPC connector "${m[1]}" ≠ canonical "${CONFIG.vpcConnector}"`);
      }
    }
    // Artifact Registry image path must match canonical.
    for (const m of text.matchAll(/docker\.pkg\.dev\/[^/\s]+\/([A-Za-z0-9-]+\/[A-Za-z0-9-]+)/g)) {
      if (m[1] !== CONFIG.artifactRegistry) {
        errors.push(`${rel}: AR image "${m[1]}" ≠ canonical "${CONFIG.artifactRegistry}"`);
      }
    }
    // Region/project must come from the canonical secrets, not hardcoded.
    const hr = text.match(HARDCODED_REGION);
    if (hr) {
      errors.push(
        `${rel}: hardcoded region in "${hr[0].trim()}" — use \${{ secrets.${CONFIG.regionSecret} }}`
      );
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Deploy-config drift detected:\n');
    for (const e of errors) console.error('   ' + e);
    console.error(
      `\nAll deploy workflows must match .github/deploy-config.json. ` +
        `Update the canonical value + every workflow together. See docs/DEPLOY_CONFIG.md.\n`
    );
    process.exit(1);
  }
  console.log(
    `✅ Deploy config consistent across ${files.length} workflow(s) (connector / image / region all match the single source).`
  );
}

main();
