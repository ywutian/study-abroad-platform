import type { ILLMProvider } from '../providers/llm-provider.interface';
import {
  LLMChatRequest,
  LLMErrorCode,
  LLMProviderError,
  LLMStreamChunk,
  LLMStreamFailure,
} from '../providers/llm-provider.types';
import { AgentRunBudgetTracker } from './agent-run-context';
import type { LLMOptions } from './llm.service';

export interface SolveStreamEvidence {
  phase: 'agent.solve' | 'agent.revise';
  attempt: number;
  outcome: 'complete' | 'retry' | 'failed' | 'cancelled';
  reasonCode: string;
  elapsedMs: number;
  timeoutMs: number;
  /** Reserved input tokens for this attempt: the other half of the Run budget. */
  inputTokens: number;
  outputBytes: number;
  firstContentMs: number | null;
  transport?: LLMStreamFailure;
}

export function isHarnessSolve(
  provider: ILLMProvider,
  options: LLMOptions,
): options is LLMOptions & {
  runBudget: AgentRunBudgetTracker;
  taskType: SolveStreamEvidence['phase'];
} {
  return (
    provider.providerId === 'openai' &&
    !!options.runBudget &&
    !options.runBudget.limits.routing &&
    !options.tools?.length &&
    (options.taskType === 'agent.solve' || options.taskType === 'agent.revise')
  );
}

export function harnessStreamReason(error: unknown): string {
  if (
    error instanceof LLMProviderError &&
    Object.values(LLMErrorCode).includes(error.code)
  )
    return error.code;
  if (
    error instanceof Error &&
    /^AGENT_(TOKEN_BUDGET_EXCEEDED|DURATION_BUDGET_EXCEEDED|STREAM_INCOMPLETE)$/.test(
      error.message,
    )
  )
    return error.message;
  return 'AGENT_STREAM_FAILED';
}

function safeTransport(value?: LLMStreamFailure): LLMStreamFailure | undefined {
  if (
    !value ||
    !['connect', 'read', 'protocol'].includes(value.phase) ||
    !['deadline', 'transport', 'http', 'protocol'].includes(value.reason)
  )
    return undefined;
  const numbers = [
    value.elapsedMs,
    value.receivedBytes,
    value.emittedBytes,
    ...(value.firstByteMs === null ? [] : [value.firstByteMs]),
  ];
  if (!numbers.every((n) => Number.isFinite(n) && n >= 0)) return undefined;
  return {
    phase: value.phase,
    reason: value.reason,
    elapsedMs: value.elapsedMs,
    receivedBytes: value.receivedBytes,
    emittedBytes: value.emittedBytes,
    firstByteMs: value.firstByteMs,
    ...(value.retryAfterRequested === true
      ? { retryAfterRequested: true }
      : {}),
  };
}

/** Only tool-free Solve can retry: identical request, at most twice, no emitted content. */
export async function* harnessSolveStream(options: {
  provider: ILLMProvider;
  request: LLMChatRequest;
  budget: AgentRunBudgetTracker;
  phase: SolveStreamEvidence['phase'];
  observe: (evidence: SolveStreamEvidence) => void;
}): AsyncGenerator<LLMStreamChunk> {
  const { provider, request, budget } = options;
  if (
    provider.providerId !== 'openai' ||
    request.tools?.length ||
    request.routed ||
    budget.limits.routing
  )
    throw new Error('AGENT_STREAM_FAILED');
  const started = Date.now();
  const deadline =
    started +
    Math.min(
      request.timeoutMs ?? budget.remainingDurationMs(),
      budget.remainingDurationMs(),
    );
  if (!Number.isFinite(deadline))
    throw new Error('AGENT_DURATION_BUDGET_EXCEEDED');
  for (let attempt = 1; attempt <= 2; attempt++) {
    const timeoutMs = Math.floor(
      Math.min(deadline - Date.now(), budget.remainingDurationMs()),
    );
    if (timeoutMs <= 0) throw new Error('AGENT_DURATION_BUDGET_EXCEEDED');
    budget.assertWithinDuration();
    const reservation = budget.reserveLlmCall(
      request.systemPrompt,
      request.messages.map((m) => ({ content: m.content ?? '' })),
      request.maxTokens ?? 4000,
    );
    let output = '',
      firstContentMs: number | null = null;
    let terminal: LLMStreamChunk | undefined;
    let unsafeToRetry = false,
      finished = false;
    const emit = (
      outcome: SolveStreamEvidence['outcome'],
      reasonCode: string,
      transport?: LLMStreamFailure,
    ) =>
      options.observe({
        phase: options.phase,
        attempt,
        outcome,
        reasonCode,
        elapsedMs: Date.now() - started,
        timeoutMs,
        inputTokens: reservation.inputTokens,
        outputBytes: Buffer.byteLength(output, 'utf8'),
        firstContentMs,
        ...(transport ? { transport } : {}),
      });
    try {
      for await (const chunk of provider.chatStream({
        ...request,
        timeoutMs,
        maxTokens: reservation.outputTokens,
      })) {
        budget.assertWithinDuration();
        if (Date.now() >= deadline)
          throw new Error('AGENT_DURATION_BUDGET_EXCEEDED');
        if (terminal) throw new Error('AGENT_STREAM_INCOMPLETE');
        if (chunk.type === 'error') throw new Error('AGENT_STREAM_FAILED');
        if (chunk.type.startsWith('tool_call')) {
          unsafeToRetry = true;
          throw new Error('AGENT_STREAM_FAILED');
        }
        if (chunk.type === 'done') {
          unsafeToRetry = true;
          terminal = chunk;
        } else {
          if (chunk.content) {
            unsafeToRetry = true;
            firstContentMs ??= Date.now() - started;
            output += chunk.content;
          }
          yield chunk;
        }
      }
      if (!terminal) throw new Error('AGENT_STREAM_INCOMPLETE');
      // Settle only after the source has ended; never expose done before
      // settlement. A complete answer is delivered even when final usage
      // overruns the Run budget — the overage is recorded, so the next call
      // still fails closed — but an incomplete stream never reaches here.
      unsafeToRetry = true;
      const overrun = budget.settleTerminalLlmCall(
        reservation,
        output,
        terminal.usage,
        options.phase,
      );
      finished = true;
      emit('complete', overrun ?? 'OK');
      yield terminal;
      return;
    } catch (error) {
      // Failed/unknown usage retains the entire reservation, including output.
      // Only a trusted typed transient failure before any visible effect can retry.
      const transport = safeTransport(
        error instanceof LLMProviderError ? error.streamFailure : undefined,
      );
      const code = harnessStreamReason(error);
      const reasonCode =
        code === 'NETWORK_ERROR' && budget.remainingDurationMs() <= 0
          ? 'AGENT_DURATION_BUDGET_EXCEEDED'
          : code;
      const retry =
        attempt === 1 &&
        !unsafeToRetry &&
        error instanceof LLMProviderError &&
        error.retryable &&
        [LLMErrorCode.NETWORK_ERROR, LLMErrorCode.SERVER_ERROR].includes(
          error.code,
        ) &&
        (!error.streamFailure || !!transport) &&
        transport?.reason !== 'deadline' &&
        !transport?.retryAfterRequested &&
        deadline - Date.now() > 250 &&
        budget.remainingDurationMs() > 250 &&
        budget.remainingTokens() >= reservation.inputTokens + 256;
      finished = true;
      emit(retry ? 'retry' : 'failed', reasonCode, transport);
      if (!retry) throw new Error(reasonCode);
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    } finally {
      // A consumer return() closes the provider generator and never starts a retry.
      if (!finished) emit('cancelled', 'CONSUMER_CLOSED');
    }
  }
}
