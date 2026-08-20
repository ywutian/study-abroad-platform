import { Injectable } from '@nestjs/common';
import { getToolMetadata } from '../config/tools.config';
import {
  AgentHarnessMode,
  AgentType,
  ToolPolicyDecision,
  UserContext,
} from '../types';

export interface ToolPolicyInput {
  toolName: string;
  mode: AgentHarnessMode;
  agentType: AgentType;
  userContext: UserContext;
  allowedToolNames: ReadonlySet<string>;
}

@Injectable()
export class ToolPolicyService {
  evaluate(input: ToolPolicyInput): ToolPolicyDecision {
    const metadata = getToolMetadata(input.toolName);

    if (!metadata) {
      return { action: 'deny', reasonCode: 'UNKNOWN_TOOL_METADATA' };
    }

    if (!input.allowedToolNames.has(input.toolName)) {
      return { action: 'deny', reasonCode: 'TOOL_NOT_ALLOWED_FOR_AGENT' };
    }

    if (
      input.mode === 'advisory' &&
      metadata.effect !== 'read' &&
      metadata.effect !== 'generate'
    ) {
      return {
        action: 'deny',
        reasonCode: 'EFFECT_NOT_ALLOWED_IN_ADVISORY',
      };
    }

    if (metadata.requiresConfirmation) {
      return {
        action: 'confirmation_required',
        reasonCode: 'CONFIRMATION_REQUIRED',
      };
    }

    return { action: 'allow', reasonCode: 'ALLOWED' };
  }
}
