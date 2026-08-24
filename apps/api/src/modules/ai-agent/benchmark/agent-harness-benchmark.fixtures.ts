import { AgentType } from '@study-abroad/shared';
import type { ToolCall } from '../types';
import type {
  BenchmarkFixture,
  DeterministicResponse,
} from './agent-harness-benchmark.types';
import { MAX_TOOL_CALLS_PER_CASE } from './agent-harness-benchmark.types';

function toolCall(
  id: string,
  name: string,
  args: Record<string, unknown> = {},
): ToolCall {
  return { id, name, arguments: args };
}

function response(
  content: string,
  toolCalls: ToolCall[] | undefined,
  promptTokens: number,
  completionTokens: number,
  modeledLatencyMs: number,
): DeterministicResponse {
  return {
    content,
    toolCalls,
    promptTokens,
    completionTokens,
    modeledLatencyMs,
  };
}

const schoolOne = toolCall('school-1', 'get_school_details', {
  schoolName: 'Synthetic University One',
});
const schoolTwo = toolCall('school-2', 'get_school_details', {
  schoolName: 'Synthetic University Two',
});
const profileRead = toolCall('profile-read', 'get_profile');
const schoolSearch = toolCall('school-search', 'search_schools', {
  rankRange: '1-20',
});
const profileWrite = toolCall('profile-write', 'update_profile', {
  field: 'targetMajor',
  value: 'Synthetic Major',
});
const externalSearch = toolCall('external-search', 'web_search', {
  query: 'synthetic current admissions policy',
});
const unknownTool = toolCall('unknown-tool', 'unregistered_synthetic_tool');
const budgetCalls = Array.from({ length: 20 }, (_, index) =>
  toolCall(`budget-${index + 1}`, 'get_school_details', {
    schoolName: `Synthetic Budget University ${index + 1}`,
  }),
);

/** Frozen synthetic fixtures; bodies and arguments never enter the report. */
export const AGENT_HARNESS_BENCHMARK_FIXTURES: readonly BenchmarkFixture[] = [
  {
    id: 'direct-answer',
    agentType: AgentType.ORCHESTRATOR,
    harnessMode: 'advisory',
    input: 'Synthetic greeting that needs no tools.',
    initial: response('Synthetic direct answer.', undefined, 80, 20, 10),
    supplemental: [],
    solve: response('Unused solve answer.', undefined, 0, 0, 0),
    expectedAllowed: [],
    expectedRefused: [],
  },
  {
    id: 'same-tool-distinct-arguments',
    agentType: AgentType.SCHOOL,
    harnessMode: 'advisory',
    input: 'Compare two synthetic universities.',
    initial: response('', [schoolOne, schoolTwo], 100, 20, 10),
    supplemental: [response('', undefined, 70, 10, 8)],
    solve: response('Synthetic comparison complete.', undefined, 120, 30, 12),
    expectedAllowed: [schoolOne, schoolTwo],
    expectedRefused: [],
  },
  {
    id: 'supplemental-observation-recovery',
    agentType: AgentType.SCHOOL,
    harnessMode: 'advisory',
    input: 'Use a synthetic profile to find schools.',
    initial: response('', [profileRead], 100, 20, 10),
    supplemental: [
      response('', [schoolSearch], 80, 10, 8),
      response('', undefined, 70, 10, 8),
    ],
    solve: response(
      'Synthetic recommendations complete.',
      undefined,
      120,
      30,
      12,
    ),
    expectedAllowed: [profileRead, schoolSearch],
    expectedRefused: [],
  },
  {
    id: 'protected-write-refusal',
    agentType: AgentType.PROFILE,
    harnessMode: 'action',
    input: 'Perform a synthetic protected profile update.',
    initial: response('', [profileWrite], 100, 20, 10),
    supplemental: [response('', undefined, 70, 10, 8)],
    solve: response(
      'Synthetic protected action response.',
      undefined,
      120,
      30,
      12,
    ),
    expectedAllowed: [],
    expectedRefused: [profileWrite],
  },
  {
    id: 'advisory-external-refusal',
    agentType: AgentType.SCHOOL,
    harnessMode: 'advisory',
    input: 'Search an external source in advisory mode.',
    initial: response('', [externalSearch], 100, 20, 10),
    supplemental: [response('', undefined, 70, 10, 8)],
    solve: response('Synthetic advisory response.', undefined, 120, 30, 12),
    expectedAllowed: [],
    expectedRefused: [externalSearch],
  },
  {
    id: 'cross-round-duplicate-prevention',
    agentType: AgentType.PROFILE,
    harnessMode: 'advisory',
    input: 'Read the same synthetic profile once.',
    initial: response('', [profileRead], 100, 20, 10),
    supplemental: [
      response('', [toolCall('profile-read-again', 'get_profile')], 70, 10, 8),
      response('', undefined, 70, 10, 8),
    ],
    solve: response('Synthetic profile response.', undefined, 120, 30, 12),
    expectedAllowed: [profileRead],
    expectedRefused: [],
  },
  {
    id: 'tool-budget-cap',
    agentType: AgentType.SCHOOL,
    harnessMode: 'advisory',
    input: 'Inspect a synthetic oversized school batch.',
    initial: response('', budgetCalls, 160, 40, 14),
    supplemental: [],
    solve: response('Synthetic bounded response.', undefined, 140, 30, 12),
    expectedAllowed: budgetCalls.slice(0, MAX_TOOL_CALLS_PER_CASE),
    expectedRefused: [],
  },
  {
    id: 'unknown-tool-fail-closed',
    agentType: AgentType.ORCHESTRATOR,
    harnessMode: 'action',
    input: 'Attempt a synthetic unregistered tool.',
    initial: response('', [unknownTool], 100, 20, 10),
    supplemental: [response('', undefined, 70, 10, 8)],
    solve: response('Synthetic unknown-tool response.', undefined, 120, 30, 12),
    expectedAllowed: [],
    expectedRefused: [unknownTool],
  },
] as const;
