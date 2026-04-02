#!/usr/bin/env bash
set -euo pipefail

cd "/Users/yitianwu/Documents/study-abroad-platform"
pnpm exec tsx scripts/runtime-release-gate.ts --config "/Users/yitianwu/Documents/study-abroad-platform/e2e-report/releases/prereq-regression-demo/codex-run-config.json"
