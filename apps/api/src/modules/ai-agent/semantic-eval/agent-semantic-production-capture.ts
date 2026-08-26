import { resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type { SemanticEvalCase } from './agent-semantic-eval.types';

export interface SemanticCaptureEvent {
  type?: string;
  content?: string;
  tool?: string;
  runId?: string;
  runStatus?: string;
  response?: {
    message?: string;
    toolsUsed?: string[];
  };
  approval?: {
    toolName?: string;
  };
}

export interface SemanticCaptureItem {
  caseId: string;
  repetition: number;
  output: string;
  toolNames: string[];
  latencyMs: number;
  httpStatus: number;
  runStatus: string;
  runIdHash: string;
}

export function summarizeExpectedInputRejection(options: {
  evalCase: SemanticEvalCase;
  repetition: number;
  latencyMs: number;
  httpStatus: number;
}): SemanticCaptureItem | null {
  if (
    options.httpStatus !== 400 ||
    options.evalCase.expectedAction !== 'refuse'
  ) {
    return null;
  }
  return {
    caseId: options.evalCase.id,
    repetition: options.repetition,
    output: 'The request was rejected by input safety controls.',
    toolNames: [],
    latencyMs: options.latencyMs,
    httpStatus: options.httpStatus,
    runStatus: 'INPUT_REJECTED',
    runIdHash: '',
  };
}

export function assertPrivateTemporaryCapturePath(input: string): string {
  const output = resolve(input);
  const temporaryRoot = resolve(tmpdir());
  if (
    output !== temporaryRoot &&
    !output.startsWith(`${temporaryRoot}${sep}`)
  ) {
    throw new Error(
      'Capture output must stay under the operating-system temporary directory',
    );
  }
  return output;
}

export function renderProductionCaseInput(evalCase: SemanticEvalCase): string {
  if (!evalCase.contextMessages?.length) return evalCase.input;
  const transcript = evalCase.contextMessages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n');
  return [
    'The following is synthetic prior conversation context for this evaluation.',
    '<synthetic_conversation_context>',
    transcript,
    '</synthetic_conversation_context>',
    `CURRENT_USER: ${evalCase.input}`,
  ].join('\n');
}

export function summarizeProductionEvents(
  events: SemanticCaptureEvent[],
  options: {
    caseId: string;
    repetition: number;
    latencyMs: number;
    httpStatus: number;
    hashRunId: (runId: string) => string;
  },
): SemanticCaptureItem {
  const done = [...events].reverse().find((event) => event.type === 'done');
  const approval = events.find((event) => event.type === 'approval_required');
  const content = events
    .filter(
      (event) => event.type === 'content' && typeof event.content === 'string',
    )
    .map((event) => event.content)
    .join('');
  const output =
    done?.response?.message ||
    content ||
    (approval ? 'Confirmation is required before this action can run.' : '');
  const toolNames = new Set<string>();
  for (const event of events) {
    if (event.type === 'tool_start' && event.tool) toolNames.add(event.tool);
    if (event.type === 'approval_required' && event.approval?.toolName) {
      toolNames.add(event.approval.toolName);
    }
    for (const tool of event.response?.toolsUsed ?? []) toolNames.add(tool);
  }
  const runId = events.find((event) => event.runId)?.runId ?? '';
  const runStatus =
    [...events].reverse().find((event) => event.runStatus)?.runStatus ??
    (approval ? 'WAITING_APPROVAL' : 'UNKNOWN');
  return {
    caseId: options.caseId,
    repetition: options.repetition,
    output,
    toolNames: [...toolNames].sort(),
    latencyMs: options.latencyMs,
    httpStatus: options.httpStatus,
    runStatus,
    runIdHash: runId ? options.hashRunId(runId) : '',
  };
}
