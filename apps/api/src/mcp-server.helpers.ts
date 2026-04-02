import {
  ContentModerationService,
  ModerationAction,
} from './modules/ai-agent/security/content-moderation.service';
import type { McpKeyValidationStatus } from './modules/auth/mcp-api-key.service';

const MODERATED_MCP_TOOLS = new Set([
  'generate_outline',
  'create_timeline',
  'review_essay',
  'polish_essay',
  'brainstorm_ideas',
]);

export function normalizeMcpArguments(
  args?: Record<string, unknown>,
): Record<string, unknown> {
  return args ?? {};
}

export function getMcpAuthErrorMessage(status: McpKeyValidationStatus): string {
  switch (status) {
    case 'revoked':
      return 'Revoked MCP_API_KEY';
    case 'expired':
      return 'Expired MCP_API_KEY';
    case 'user_inactive':
      return 'MCP_API_KEY belongs to an inactive user';
    case 'invalid':
    default:
      return 'Invalid MCP_API_KEY';
  }
}

export async function serializeMcpToolContent(
  toolName: string,
  result: { success: boolean; result?: unknown; error?: string },
  moderation: Pick<ContentModerationService, 'moderateOutput'>,
): Promise<string> {
  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const serialized = JSON.stringify(result.result ?? null, null, 2);
  if (!MODERATED_MCP_TOOLS.has(toolName)) {
    return serialized;
  }

  const moderationResult = await moderation.moderateOutput(serialized);
  if (moderationResult.action === ModerationAction.BLOCK) {
    return 'Error: Tool output blocked by security check';
  }

  return moderationResult.sanitizedContent || serialized;
}
