/**
 * Shared ts-morph Project factory for governance rules.
 *
 * Scope: apps/api/src/modules/ai-agent/ only.
 * Excludes spec/e2e files via runtime filter (not negation glob, which is unreliable in some ts-morph versions).
 */

import { Project } from 'ts-morph';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

export function createGovernanceProject(): Project {
  const project = new Project({
    tsConfigFilePath: path.join(ROOT, 'apps/api/tsconfig.build.json'),
    skipAddingFilesFromTsConfig: true,
  });

  // Add only ai-agent scope
  project.addSourceFilesAtPaths(path.join(ROOT, 'apps/api/src/modules/ai-agent/**/*.ts'));

  // Runtime filter: remove spec files (negation glob is unreliable)
  for (const sf of project.getSourceFiles()) {
    const fp = sf.getFilePath();
    if (fp.includes('.spec.ts') || fp.includes('.e2e-spec.ts')) {
      project.removeSourceFile(sf);
    }
  }

  // Assert: no spec files remain
  const specLeak = project.getSourceFiles().filter((f) => f.getFilePath().includes('.spec.'));
  if (specLeak.length > 0) {
    throw new Error(
      `ts-morph project contains spec files: ${specLeak.map((f) => f.getFilePath()).join(', ')}`
    );
  }

  return project;
}
