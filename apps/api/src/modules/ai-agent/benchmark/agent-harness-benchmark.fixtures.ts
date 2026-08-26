import { AgentType } from '@study-abroad/shared';
import { TOOL_METADATA, TOOLS, ToolName } from '../config/tools.config';
import type { ToolCall } from '../types';
import type {
  BenchmarkFixture,
  DeterministicResponse,
} from './agent-harness-benchmark.types';
import { MAX_TOOL_CALLS_PER_CASE } from './agent-harness-benchmark.types';
import { BENCHMARK_PRODUCTION_TOOL_NAMES } from './agent-harness-benchmark.tools';

const AGENT_TYPES = [
  AgentType.ORCHESTRATOR,
  AgentType.ESSAY,
  AgentType.SCHOOL,
  AgentType.PROFILE,
  AgentType.TIMELINE,
  AgentType.RESUME,
] as const;

const WRITE_TOOL_NAMES = [
  ToolName.UPDATE_PROFILE,
  ToolName.CREATE_PERSONAL_EVENT,
] as const;

const EXTERNAL_TOOL_NAMES = [
  ToolName.WEB_SEARCH,
  ToolName.SEARCH_SCHOOL_WEBSITE,
] as const;

const AGENT_SCOPE_TOOL_NAMES = [
  ToolName.GET_RESUME_DETAILS,
  ToolName.REVIEW_RESUME,
  ToolName.OPTIMIZE_RESUME_BULLETS,
  ToolName.SUGGEST_RESUME_CONTENT,
  ToolName.GET_ESSAYS,
  ToolName.REVIEW_ESSAY,
  ToolName.RECOMMEND_SCHOOLS,
  ToolName.ANALYZE_ADMISSION_CHANCE,
  ToolName.GET_PROFILE,
  ToolName.SEARCH_CASES,
] as const;

const SAFE_TOOL_NAMES = BENCHMARK_PRODUCTION_TOOL_NAMES.filter(
  (name) =>
    name !== ToolName.DELEGATE_TO_AGENT &&
    (TOOL_METADATA[name].effect === 'read' ||
      TOOL_METADATA[name].effect === 'generate'),
);

const ARGUMENT_SAFE_TOOL_NAMES = SAFE_TOOL_NAMES.filter((name) => {
  const definition = TOOLS.find((tool) => tool.name === String(name));
  return Object.keys(definition?.parameters.properties ?? {}).length > 0;
});

function response(
  content: string,
  toolCalls: ToolCall[] | undefined,
  promptTokens = 100,
  completionTokens = 20,
  modeledLatencyMs = 10,
): DeterministicResponse {
  return {
    content,
    toolCalls,
    promptTokens,
    completionTokens,
    modeledLatencyMs,
  };
}

function syntheticValue(
  schema: { type: string; enum?: string[] },
  toolName: string,
  key: string,
  variant: number,
): unknown {
  if (schema.enum?.length) return schema.enum[variant % schema.enum.length];
  if (schema.type === 'number') return 100 + variant;
  if (schema.type === 'boolean') return variant % 2 === 0;
  if (schema.type === 'array') return [`synthetic-${variant}`];
  if (schema.type === 'object') return { synthetic: variant };
  return `synthetic-${toolName}-${key}-${variant}`;
}

function syntheticArguments(
  toolName: string,
  variant: number,
): Record<string, unknown> {
  if (toolName === String(ToolName.DELEGATE_TO_AGENT)) {
    return {
      agent: variant % 2 === 0 ? 'school' : 'essay',
      task: `synthetic-delegation-${variant}`,
    };
  }
  const definition = TOOLS.find((tool) => tool.name === toolName);
  if (!definition) return {};
  const properties = definition.parameters.properties;
  const required = definition.parameters.required ?? [];
  const selectedKeys =
    required.length > 0 ? required : Object.keys(properties).slice(0, 1);
  return Object.fromEntries(
    selectedKeys.map((key) => [
      key,
      syntheticValue(properties[key], toolName, key, variant),
    ]),
  );
}

function toolCall(
  id: string,
  name: string,
  variant: number,
  argumentsOverride?: Record<string, unknown>,
): ToolCall {
  return {
    id,
    name,
    arguments: argumentsOverride ?? syntheticArguments(name, variant),
  };
}

function agentFor(index: number): AgentType {
  return AGENT_TYPES[index % AGENT_TYPES.length];
}

function localeFor(index: number): 'en' | 'zh' {
  return index % 2 === 0 ? 'zh' : 'en';
}

function syntheticContext(
  id: string,
  turns: number,
): BenchmarkFixture['contextMessages'] {
  return Array.from({ length: turns * 2 }, (_, index) => ({
    role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `Synthetic prior turn ${id}-${index + 1}.`,
  }));
}

function directFixture(index: number): BenchmarkFixture {
  const id = `core-business-${String(index + 1).padStart(2, '0')}`;
  if (index < 3) {
    return {
      id,
      category: 'core_business',
      agentType: agentFor(index),
      harnessMode: 'advisory',
      locale: localeFor(index),
      input: `Synthetic direct-answer request ${index + 1}.`,
      contextMessages: [],
      initial: response(`Synthetic direct answer ${index + 1}.`, undefined),
      supplemental: [],
      solve: response('Unused synthetic solve.', undefined, 0, 0, 0),
      expectedAllowed: [],
      expectedRefused: [],
      expectedFailures: [],
      expectedSupplementalRounds: 0,
    };
  }
  if (index === 3) {
    const delegation = toolCall(
      'core-delegation',
      ToolName.DELEGATE_TO_AGENT,
      index,
    );
    return {
      id,
      category: 'core_business',
      agentType: AgentType.ORCHESTRATOR,
      harnessMode: 'advisory',
      locale: localeFor(index),
      input: 'Synthetic request that belongs to a specialist.',
      contextMessages: [],
      initial: response('', [delegation]),
      supplemental: [],
      solve: response('Unused synthetic solve.', undefined, 0, 0, 0),
      expectedAllowed: [],
      expectedRefused: [],
      expectedFailures: [],
      expectedSupplementalRounds: 0,
      expectDelegation: true,
    };
  }
  const name = SAFE_TOOL_NAMES[(index - 4) % SAFE_TOOL_NAMES.length];
  const call = toolCall(`core-${index + 1}`, name, index + 1);
  return {
    id,
    category: 'core_business',
    agentType: agentFor(index),
    harnessMode: 'advisory',
    locale: localeFor(index),
    input: `Synthetic core business request ${index + 1}.`,
    contextMessages: [],
    initial: response('', [call]),
    supplemental: [],
    solve: response(
      `Synthetic core result ${index + 1}.`,
      undefined,
      120,
      30,
      12,
    ),
    expectedAllowed: [call],
    expectedRefused: [],
    expectedFailures: [],
    expectedSupplementalRounds: 1,
  };
}

function multiTurnFixture(index: number): BenchmarkFixture {
  const id = `multi-turn-context-${String(index + 1).padStart(2, '0')}`;
  const firstName = SAFE_TOOL_NAMES[index % SAFE_TOOL_NAMES.length];
  const secondName = SAFE_TOOL_NAMES[(index + 11) % SAFE_TOOL_NAMES.length];
  const first = toolCall(`multi-${index + 1}-first`, firstName, index + 20);
  const second = toolCall(`multi-${index + 1}-second`, secondName, index + 60);
  return {
    id,
    category: 'multi_turn_context',
    agentType: agentFor(index + 2),
    harnessMode: 'advisory',
    locale: localeFor(index),
    input: `Synthetic multi-turn request ${index + 1}.`,
    contextMessages: syntheticContext(id, 6 + (index % 5)),
    initial: response('', [first], 130, 25, 12),
    supplemental: [
      response('', [second], 90, 15, 9),
      response('', undefined, 70, 10, 7),
    ],
    solve: response(
      `Synthetic multi-turn result ${index + 1}.`,
      undefined,
      140,
      35,
      14,
    ),
    expectedAllowed: [first, second],
    expectedRefused: [],
    expectedFailures: [],
    expectedSupplementalRounds: 2,
  };
}

function toolBoundaryFixture(index: number): BenchmarkFixture {
  const id = `tool-boundary-${String(index + 1).padStart(2, '0')}`;
  if (index < 10) {
    const name =
      ARGUMENT_SAFE_TOOL_NAMES[index % ARGUMENT_SAFE_TOOL_NAMES.length];
    const first = toolCall(`boundary-${index + 1}-a`, name, index + 100);
    const second = toolCall(`boundary-${index + 1}-b`, name, index + 200);
    return {
      id,
      category: 'tool_boundary',
      agentType: agentFor(index + 4),
      harnessMode: 'advisory',
      locale: localeFor(index),
      input: `Synthetic same-tool distinct-argument request ${index + 1}.`,
      contextMessages: [],
      initial: response('', [first, second], 120, 25, 11),
      supplemental: [],
      solve: response(
        'Synthetic distinct-argument result.',
        undefined,
        130,
        30,
        12,
      ),
      expectedAllowed: [first, second],
      expectedRefused: [],
      expectedFailures: [],
      expectedSupplementalRounds: 1,
    };
  }
  const name = SAFE_TOOL_NAMES[index % SAFE_TOOL_NAMES.length];
  const first = toolCall(`boundary-${index + 1}-first`, name, index + 300);
  const duplicate = toolCall(
    `boundary-${index + 1}-duplicate`,
    name,
    index + 300,
    first.arguments,
  );
  return {
    id,
    category: 'tool_boundary',
    agentType: agentFor(index + 4),
    harnessMode: 'advisory',
    locale: localeFor(index),
    input: `Synthetic cross-round duplicate request ${index + 1}.`,
    contextMessages: [],
    initial: response('', [first], 110, 20, 10),
    supplemental: [
      response('', [duplicate], 80, 15, 8),
      response('', undefined, 70, 10, 7),
    ],
    solve: response('Synthetic deduplicated result.', undefined, 130, 30, 12),
    expectedAllowed: [first],
    expectedRefused: [],
    expectedFailures: [],
    expectedSupplementalRounds: 2,
  };
}

function permissionFixture(index: number): BenchmarkFixture {
  const id = `permission-security-${String(index + 1).padStart(2, '0')}`;
  let call: ToolCall;
  let harnessMode: BenchmarkFixture['harnessMode'] = 'action';
  let authorizedToolNames: readonly string[] | undefined;
  if (index < WRITE_TOOL_NAMES.length) {
    call = toolCall(
      `permission-write-${index + 1}`,
      WRITE_TOOL_NAMES[index],
      index + 400,
    );
  } else if (index < WRITE_TOOL_NAMES.length + EXTERNAL_TOOL_NAMES.length) {
    const externalIndex = index - WRITE_TOOL_NAMES.length;
    call = toolCall(
      `permission-external-${externalIndex + 1}`,
      EXTERNAL_TOOL_NAMES[externalIndex],
      index + 400,
    );
    harnessMode = 'advisory';
  } else if (index < 14) {
    const scopeIndex =
      index - WRITE_TOOL_NAMES.length - EXTERNAL_TOOL_NAMES.length;
    call = toolCall(
      `permission-agent-scope-${index + 1}`,
      AGENT_SCOPE_TOOL_NAMES[scopeIndex % AGENT_SCOPE_TOOL_NAMES.length],
      index + 400,
    );
    authorizedToolNames = [];
  } else {
    call = toolCall(
      'permission-unknown-tool',
      'unregistered_synthetic_tool',
      index + 400,
    );
  }
  return {
    id,
    category: 'permission_security',
    agentType: agentFor(index),
    harnessMode,
    locale: localeFor(index),
    input: `Synthetic permission boundary request ${index + 1}.`,
    contextMessages: [],
    initial: response('', [call], 115, 20, 10),
    supplemental: [response('', undefined, 70, 10, 7)],
    solve: response(
      'Synthetic permission-safe response.',
      undefined,
      125,
      30,
      12,
    ),
    expectedAllowed: [],
    expectedRefused: [call],
    expectedFailures: [],
    expectedSupplementalRounds: 1,
    authorizedToolNames,
  };
}

function failureFixture(index: number): BenchmarkFixture {
  const id = `failure-recovery-${String(index + 1).padStart(2, '0')}`;
  const initialName = SAFE_TOOL_NAMES[index % SAFE_TOOL_NAMES.length];
  const initial = toolCall(
    `failure-${index + 1}-initial`,
    initialName,
    index + 500,
  );
  const recovery =
    index < 8
      ? toolCall(
          `failure-${index + 1}-retry`,
          initialName,
          index + 500,
          initial.arguments,
        )
      : toolCall(
          `failure-${index + 1}-fallback`,
          SAFE_TOOL_NAMES[(index + 9) % SAFE_TOOL_NAMES.length],
          index + 600,
        );
  return {
    id,
    category: 'failure_recovery',
    agentType: agentFor(index + 1),
    harnessMode: 'advisory',
    locale: localeFor(index),
    input: `Synthetic recoverable tool failure ${index + 1}.`,
    contextMessages: [],
    initial: response('', [initial], 125, 25, 12),
    supplemental: [
      response('', [recovery], 90, 15, 9),
      response('', undefined, 70, 10, 7),
    ],
    solve: response('Synthetic recovery result.', undefined, 135, 30, 13),
    expectedAllowed: [initial, recovery],
    expectedRefused: [],
    expectedFailures: [initial],
    expectedSupplementalRounds: 2,
    failurePlan: [{ call: initial, failures: 1 }],
  };
}

function budgetFixture(index: number): BenchmarkFixture {
  const id = `budget-extreme-${String(index + 1).padStart(2, '0')}`;
  if (index < 5) {
    const calls = Array.from({ length: 20 + index }, (_, callIndex) =>
      toolCall(
        `budget-${index + 1}-${callIndex + 1}`,
        ToolName.GET_SCHOOL_DETAILS,
        index * 100 + callIndex + 700,
      ),
    );
    return {
      id,
      category: 'budget_extreme',
      agentType: AgentType.SCHOOL,
      harnessMode: 'advisory',
      locale: localeFor(index),
      input: `Synthetic oversized tool batch ${index + 1}.`,
      contextMessages: [],
      initial: response('', calls, 180, 45, 16),
      supplemental: [],
      solve: response('Synthetic bounded tool result.', undefined, 150, 35, 14),
      expectedAllowed: calls.slice(0, MAX_TOOL_CALLS_PER_CASE),
      expectedRefused: [],
      expectedFailures: [],
      expectedSupplementalRounds: 0,
    };
  }
  const calls = Array.from({ length: 5 }, (_, callIndex) =>
    toolCall(
      `round-budget-${index + 1}-${callIndex + 1}`,
      SAFE_TOOL_NAMES[(index + callIndex) % SAFE_TOOL_NAMES.length],
      index * 100 + callIndex + 900,
    ),
  );
  return {
    id,
    category: 'budget_extreme',
    agentType: agentFor(index),
    harnessMode: 'advisory',
    locale: localeFor(index),
    input: `Synthetic supplemental-round overflow ${index + 1}.`,
    contextMessages: [],
    initial: response('', [calls[0]], 130, 25, 12),
    supplemental: calls.slice(1).map((call) => response('', [call], 85, 15, 8)),
    solve: response(
      'Synthetic bounded replanning result.',
      undefined,
      140,
      35,
      13,
    ),
    expectedAllowed: calls.slice(0, 3),
    expectedRefused: [],
    expectedFailures: [],
    expectedSupplementalRounds: 2,
  };
}

/** Frozen synthetic fixtures; bodies and arguments never enter the report. */
export const AGENT_HARNESS_BENCHMARK_FIXTURES: readonly BenchmarkFixture[] = [
  ...Array.from({ length: 40 }, (_, index) => directFixture(index)),
  ...Array.from({ length: 20 }, (_, index) => multiTurnFixture(index)),
  ...Array.from({ length: 20 }, (_, index) => toolBoundaryFixture(index)),
  ...Array.from({ length: 15 }, (_, index) => permissionFixture(index)),
  ...Array.from({ length: 15 }, (_, index) => failureFixture(index)),
  ...Array.from({ length: 10 }, (_, index) => budgetFixture(index)),
];
