import { AGENT_SKILL_EVAL_CASES } from './agent-skill-eval.dataset';
import { evaluateSkillHardFailures } from './agent-skill-evaluation.service';
import { AgentSkillGateMetrics } from './agent-skill.types';

const baseline: AgentSkillGateMetrics = {
  totalCases: 30,
  passedCases: 24,
  taskSuccessRate: 0.8,
  toolAccuracy: 0.85,
  refusalAccuracy: 1,
  schemaCompliance: 1,
  privacyCompliance: 1,
  permissionCompliance: 1,
  averageTokens: 1000,
  p95LatencyMs: 1000,
  failureRate: 0.2,
  targetFailureRate: 0.2,
};

describe('Agent Skill evaluation gates', () => {
  it('has exactly 30 versioned synthetic cases with unique IDs', () => {
    expect(AGENT_SKILL_EVAL_CASES).toHaveLength(30);
    expect(new Set(AGENT_SKILL_EVAL_CASES.map((item) => item.id)).size).toBe(
      30,
    );
  });

  it('passes a candidate that improves the target without regressions', () => {
    const failures = evaluateSkillHardFailures({
      baseline,
      candidate: {
        ...baseline,
        passedCases: 27,
        taskSuccessRate: 0.9,
        failureRate: 0.1,
        targetFailureRate: 0.1,
        averageTokens: 1050,
        p95LatencyMs: 1080,
      },
    });
    expect(failures).toEqual([]);
  });

  it('treats permission, privacy, refusal, and schema failures as non-compensable', () => {
    const failures = evaluateSkillHardFailures({
      baseline,
      candidate: {
        ...baseline,
        taskSuccessRate: 1,
        permissionCompliance: 0.99,
        privacyCompliance: 0.99,
        refusalAccuracy: 0.99,
        schemaCompliance: 0.99,
        targetFailureRate: 0,
      },
    });
    expect(failures).toEqual(
      expect.arrayContaining([
        'PERMISSION_GATE',
        'PRIVACY_GATE',
        'REFUSAL_GATE',
        'SCHEMA_GATE',
      ]),
    );
  });

  it('blocks cost, latency, core regression, and insufficient target improvement', () => {
    const failures = evaluateSkillHardFailures({
      baseline,
      candidate: {
        ...baseline,
        taskSuccessRate: 0.79,
        targetFailureRate: 0.16,
        averageTokens: 1101,
        p95LatencyMs: 1101,
      },
    });
    expect(failures).toEqual(
      expect.arrayContaining([
        'CORE_REGRESSION_GATE',
        'TARGET_IMPROVEMENT_GATE',
        'TOKEN_COST_GATE',
        'LATENCY_GATE',
      ]),
    );
  });
});
