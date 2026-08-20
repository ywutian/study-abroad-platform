import { ToolName, TOOL_METADATA } from '../config/tools.config';
import { AgentType, UserContext } from '../types';
import { ToolPolicyService } from './tool-policy.service';

describe('ToolPolicyService', () => {
  const service = new ToolPolicyService();
  const userContext: UserContext = { userId: 'user-1' };
  const allowedToolNames = new Set<string>(Object.values(ToolName));

  it('has explicit metadata for every registered tool name', () => {
    for (const toolName of Object.values(ToolName)) {
      expect(TOOL_METADATA[toolName]).toEqual(
        expect.objectContaining({
          effect: expect.any(String),
          risk: expect.any(String),
          retryable: expect.any(Boolean),
          requiresConfirmation: expect.any(Boolean),
          timeoutMs: expect.any(Number),
        }),
      );
    }
  });

  it('makes every durable write non-retryable and confirmation-gated', () => {
    for (const metadata of Object.values(TOOL_METADATA)) {
      if (metadata.effect === 'write') {
        expect(metadata.retryable).toBe(false);
        expect(metadata.requiresConfirmation).toBe(true);
      }
    }
  });

  it('allows read and generate tools in advisory mode', () => {
    for (const toolName of [ToolName.GET_PROFILE, ToolName.GENERATE_OUTLINE]) {
      expect(
        service.evaluate({
          toolName,
          mode: 'advisory',
          agentType: AgentType.ORCHESTRATOR,
          userContext,
          allowedToolNames,
        }),
      ).toEqual({ action: 'allow', reasonCode: 'ALLOWED' });
    }
  });

  it('denies write and external effects in advisory mode', () => {
    for (const toolName of [
      ToolName.UPDATE_PROFILE,
      ToolName.REVIEW_ESSAY,
      ToolName.WEB_SEARCH,
    ]) {
      expect(
        service.evaluate({
          toolName,
          mode: 'advisory',
          agentType: AgentType.ORCHESTRATOR,
          userContext,
          allowedToolNames,
        }).action,
      ).toBe('deny');
    }
  });

  it('requires confirmation for high-risk writes in action mode', () => {
    expect(
      service.evaluate({
        toolName: ToolName.CREATE_PERSONAL_EVENT,
        mode: 'action',
        agentType: AgentType.TIMELINE,
        userContext,
        allowedToolNames,
      }),
    ).toEqual({
      action: 'confirmation_required',
      reasonCode: 'CONFIRMATION_REQUIRED',
    });
  });

  it('allows low-risk external tools in action mode', () => {
    expect(
      service.evaluate({
        toolName: ToolName.SEARCH_SCHOOL_WEBSITE,
        mode: 'action',
        agentType: AgentType.SCHOOL,
        userContext,
        allowedToolNames,
      }),
    ).toEqual({ action: 'allow', reasonCode: 'ALLOWED' });
  });

  it('fails closed for tools without metadata', () => {
    expect(
      service.evaluate({
        toolName: 'unknown_tool',
        mode: 'action',
        agentType: AgentType.ORCHESTRATOR,
        userContext,
        allowedToolNames,
      }),
    ).toEqual({ action: 'deny', reasonCode: 'UNKNOWN_TOOL_METADATA' });
  });

  it('denies registered tools outside the current agent allowlist', () => {
    expect(
      service.evaluate({
        toolName: ToolName.UPDATE_PROFILE,
        mode: 'action',
        agentType: AgentType.SCHOOL,
        userContext,
        allowedToolNames: new Set([ToolName.SEARCH_SCHOOLS]),
      }),
    ).toEqual({ action: 'deny', reasonCode: 'TOOL_NOT_ALLOWED_FOR_AGENT' });
  });
});
