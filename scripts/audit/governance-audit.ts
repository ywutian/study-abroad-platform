import path from 'node:path';
import { findLineNumber, readText } from './utils';
import type { AgentAuditNote, AgentFinding } from './types';

function makeFinding(
  severity: AgentFinding['severity'],
  category: string,
  summary: string,
  evidence: string,
  affectedSurface: string,
  file: string,
  needle: string
): AgentFinding {
  return {
    agent: 'Governance Auditor',
    severity,
    category,
    summary,
    evidence,
    affectedSurface,
    file,
    line: findLineNumber(file, needle),
  };
}

export function runGovernanceAudit(): AgentAuditNote {
  const workflowFile = path.join(
    process.cwd(),
    'apps/api/src/modules/profile/application-analysis-workflow.service.ts'
  );
  const workflowContent = readText(workflowFile);
  const goldSetMentions = workflowContent.match(/APPLICATION_ANALYSIS_GOLD_SET/g)?.length ?? 0;

  const findings: AgentFinding[] = [
    makeFinding(
      'P0',
      'synthetic_metrics',
      'Application-analysis gate metrics are synthetic',
      'runEvaluation derives policyCorrectnessRate from approvedEvidenceCount thresholds and hardcodes weakStateCorrectnessRate, fabricatedInsightCount, actionabilityMean, render passes, and journeyPassRate.',
      'application-analysis release gate',
      workflowFile,
      'const policyCorrectnessRate ='
    ),
    makeFinding(
      'P1',
      'hardcoded_passes',
      'Render and contract gates always pass',
      'contractParityPass, webRenderPass, mobileRenderPass, and journeyPassRate are written as true/true/true/1 without executing downstream rendering or journey checks.',
      'cross-surface parity gate',
      workflowFile,
      'contractParityPass: true,'
    ),
  ];

  if (goldSetMentions <= 3) {
    findings.push(
      makeFinding(
        'P1',
        'gold_set_usage',
        'Gold set is used as metadata, not graded truth',
        'APPLICATION_ANALYSIS_GOLD_SET only contributes counts, categories, and caseIds in scopeSummary instead of driving scored correctness evaluation.',
        'gold-set governance',
        workflowFile,
        'scopeSummary:'
      )
    );
  }

  return {
    agent: 'Governance Auditor',
    summary:
      'The application-analysis governance layer currently reports candidate readiness from synthetic metrics rather than measured correctness, parity, or journey execution.',
    findings,
    notes: [
      'These gates should be treated as governance placeholders, not evidence of production accuracy.',
      'Because the gate is synthetic, a passing status cannot justify external accuracy claims.',
    ],
  };
}
