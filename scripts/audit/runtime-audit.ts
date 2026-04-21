import path from 'node:path';
import { readText, findLineNumber } from './utils';
import type { AgentAuditNote, AgentFinding } from './types';

function finding(
  severity: AgentFinding['severity'],
  category: string,
  summary: string,
  evidence: string,
  affectedSurface: string,
  file: string,
  lineNeedle: string
): AgentFinding {
  return {
    agent: 'Runtime Auditor',
    severity,
    category,
    summary,
    evidence,
    affectedSurface,
    file,
    line: findLineNumber(file, lineNeedle),
  };
}

export function runRuntimeAudit(): AgentAuditNote {
  const persistenceFile = path.join(
    process.cwd(),
    'apps/api/src/modules/prediction/prediction-persistence.service.ts'
  );
  const schemaFile = path.join(process.cwd(), 'apps/api/prisma/schema.prisma');
  const calibrationFile = path.join(
    process.cwd(),
    'apps/api/src/modules/prediction/prediction-calibration.service.ts'
  );
  const mlPrimaryFile = path.join(
    process.cwd(),
    'apps/api/src/modules/prediction/prediction-ml-primary.service.ts'
  );
  const shadowFile = path.join(
    process.cwd(),
    'apps/api/src/modules/prediction/ml/shadow-evaluator.service.ts'
  );

  const schemaContent = readText(schemaFile);
  const persistenceContent = readText(persistenceFile);
  const shadowMatches = readText(shadowFile).match(/onOutcomeReported\s*\(/g)?.length ?? 0;
  const repoShadowMatches =
    [
      readText(shadowFile),
      readText(
        path.join(process.cwd(), 'apps/api/src/modules/prediction/prediction-reporting.service.ts')
      ),
    ]
      .join('\n')
      .match(/onOutcomeReported\s*\(/g)?.length ?? 0;

  const findings: AgentFinding[] = [];

  if (
    schemaContent.includes('selectivityBand') &&
    !persistenceContent.includes('selectivityBand')
  ) {
    findings.push(
      finding(
        'P2',
        'persistence_gap',
        'Prediction persistence drops selectivityBand',
        'PredictionResult schema exposes selectivityBand, but savePrediction upsert/create payloads do not write it.',
        'prediction storage lineage',
        persistenceFile,
        'async savePrediction('
      )
    );
  }

  findings.push(
    finding(
      'P1',
      'cache_invalidation',
      'Calibration invalidation misses Platt cache',
      'invalidateCalibrationCache clears SCHOOL_CALIBRATION_CACHE_KEY only, while getPlattCalibration caches under prediction:calibration:platt.',
      'served calibration freshness',
      calibrationFile,
      'async invalidateCalibrationCache(): Promise<void> {'
    )
  );

  findings.push(
    finding(
      'P1',
      'label_quality',
      'ML tier gating counts unverified actualResult rows',
      'countLabeledData uses predictionResult.actualResult != null rather than verified outcome-label statuses, so self-reported rows can unlock stronger ML tiers.',
      'model tier selection',
      mlPrimaryFile,
      'private async countLabeledData(schoolId: string): Promise<number> {'
    )
  );

  if (shadowMatches === 1 && repoShadowMatches === 1) {
    findings.push(
      finding(
        'P1',
        'shadow_feedback',
        'Shadow evaluator outcome hook is unwired',
        'onOutcomeReported is declared in ShadowEvaluatorService but no production caller invokes it, so shadow model outcome feedback does not update evaluation state.',
        'shadow evaluation loop',
        shadowFile,
        'async onOutcomeReported('
      )
    );
  }

  return {
    agent: 'Runtime Auditor',
    summary:
      'Served prediction flow is present, but calibration freshness, label hygiene, shadow feedback, and persistence completeness all weaken runtime accuracy claims.',
    findings,
    notes: [
      'Prediction probabilities are served through the live prediction pipeline, not through the offline eval script.',
      'The most material risks are stale Platt parameters and unverified labels influencing ML tier promotion.',
      'selectivityBand persistence is a secondary observability gap rather than the primary accuracy blocker.',
    ],
  };
}
