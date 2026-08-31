import assert from 'node:assert/strict';
import { semanticBudgetEvidence } from './semantic-budget-evidence';

test('settled-call and reason projections are bounded, numeric and deny unknown keys', () => {
  const calls = Array.from({ length: 20 }, () => ({
    phase: 'agent.verify',
    estimatedInputTokens: 900,
    outputLimitTokens: 500,
    heldTokens: 2226,
    reportedInputTokens: 'private-input',
    reportedOutputTokens: -1,
    reportedTotalTokens: 3500,
    response: 'private-response',
  }));
  const result = semanticBudgetEvidence(
    {
      usage: {
        budgetCalls: calls,
        verification: {
          attempted: true,
          outcome: 'unverified',
          unverifiedReasons: {
            field_missing: 2,
            source_unusable: -1,
            'private-reason': 3,
          },
        },
      },
    },
    '',
    'en',
  );
  assert.equal(result.budgetCalls.length, 16);
  assert.equal(result.budgetCalls[0].reportedInputTokens, null);
  assert.equal(result.budgetCalls[0].reportedOutputTokens, null);
  assert.deepEqual(result.verification?.unverifiedReasons, {
    field_missing: 2,
  });
  assert.doesNotMatch(JSON.stringify(result), /private-/);
  assert.deepEqual(
    semanticBudgetEvidence(
      { usage: { budgetCalls: [{ phase: 'private-phase' }] } },
      '',
      'en',
    ).budgetCalls,
    [],
  );
});

test('only numeric owned-run evidence survives the privacy projection', () => {
  const result = semanticBudgetEvidence(
    {
      id: 'private-id',
      result: { message: 'private-content' },
      budget: { maxTokens: 24000, secret: 'private-secret' },
      usage: {
        estimatedTokens: 25000,
        toolCalls: 4,
        supplementalRounds: 2,
        elapsedMs: 1000,
      },
    },
    '部分事实尚未完成独立核验。private-output',
    'zh',
  );
  assert.equal(result.remainingTokens, 0);
  assert.equal(result.settledOrEstimatedTokens, 25000);
  assert.equal(result.unverifiedNotice, true);
  assert.doesNotMatch(JSON.stringify(result), /private-/);
});

test('absent or invalid usage remains unknown, never zero spend', () => {
  for (const usage of [
    undefined,
    null,
    {},
    { estimatedTokens: '24000' },
    { estimatedTokens: -1 },
  ]) {
    const result = semanticBudgetEvidence(
      { budget: { maxTokens: 24000 }, usage },
      '',
      'en',
    );
    assert.equal(result.status, 'unknown');
    assert.equal(result.remainingTokens, null);
    assert.equal(result.settledOrEstimatedTokens, null);
  }
});

test('verification evidence preserves fixed decisions but rejects raw or unknown outcomes', () => {
  const usage = {
    estimatedTokens: 1000,
    verification: {
      attempted: true,
      outcome: 'unverified',
      remainingTokens: 2000,
      requiredTokens: 1500,
      verified: 0,
      unverified: 3,
      toolCalls: 3,
      privateField: 'private-value',
    },
  };
  const result = semanticBudgetEvidence(
    { budget: { maxTokens: 24000 }, usage },
    '',
    'zh',
  );
  assert.equal(result.verification?.attempted, true);
  assert.equal(result.verification?.outcome, 'unverified');
  assert.doesNotMatch(JSON.stringify(result), /private-/);
  usage.verification.outcome = 'private-value';
  assert.equal(semanticBudgetEvidence({ usage }, '', 'zh').verification, null);
});
