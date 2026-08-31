import assert from 'node:assert/strict';
import { semanticBudgetEvidence } from './semantic-budget-evidence';

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
