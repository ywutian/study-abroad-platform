import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  assertPrivateTemporaryCapturePath,
  renderProductionCaseInput,
  summarizeProductionEvents,
} from './agent-semantic-production-capture';
import type { SemanticEvalCase } from './agent-semantic-eval.types';

describe('semantic production capture', () => {
  it('refuses to write review packets outside the OS temporary directory', () => {
    expect(() =>
      assertPrivateTemporaryCapturePath('/workspace/capture.json'),
    ).toThrow('temporary directory');
    expect(
      assertPrivateTemporaryCapturePath(join(tmpdir(), 'capture.json')),
    ).toBe(join(tmpdir(), 'capture.json'));
  });

  it('marks supplied conversation history as synthetic context', () => {
    const evalCase = {
      input: 'current',
      contextMessages: [
        { role: 'user', content: 'old' },
        { role: 'assistant', content: 'reply' },
      ],
    } as unknown as SemanticEvalCase;
    expect(renderProductionCaseInput(evalCase)).toContain(
      '<synthetic_conversation_context>\nUSER: old\nASSISTANT: reply',
    );
    expect(renderProductionCaseInput(evalCase)).toContain(
      'CURRENT_USER: current',
    );
  });

  it('captures model output, tools, approval and only a hashed run id', () => {
    expect(
      summarizeProductionEvents(
        [
          { type: 'start', runId: 'private-run-id' },
          {
            type: 'approval_required',
            runStatus: 'WAITING_APPROVAL',
            approval: { toolName: 'update_profile' },
          },
        ],
        {
          caseId: 'case-1',
          repetition: 2,
          latencyMs: 10,
          httpStatus: 200,
          hashRunId: () => 'hash',
        },
      ),
    ).toEqual({
      caseId: 'case-1',
      repetition: 2,
      output: 'Confirmation is required before this action can run.',
      toolNames: ['update_profile'],
      latencyMs: 10,
      httpStatus: 200,
      runStatus: 'WAITING_APPROVAL',
      runIdHash: 'hash',
    });
  });

  it('preserves direct outputs and sorts unique tools', () => {
    const item = summarizeProductionEvents(
      [
        { type: 'tool_start', tool: 'web_search' },
        {
          type: 'done',
          runStatus: 'COMPLETED',
          response: { message: 'verified answer', toolsUsed: ['web_search'] },
        },
      ],
      {
        caseId: 'case-2',
        repetition: 1,
        latencyMs: 20,
        httpStatus: 200,
        hashRunId: (value) => value,
      },
    );
    expect(item.output).toBe('verified answer');
    expect(item.toolNames).toEqual(['web_search']);
  });
});
