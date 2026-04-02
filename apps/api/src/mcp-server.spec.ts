import {
  getMcpAuthErrorMessage,
  normalizeMcpArguments,
  serializeMcpToolContent,
} from './mcp-server.helpers';
import { ModerationAction } from './modules/ai-agent/security/content-moderation.service';

describe('mcp-server helpers', () => {
  it('normalizes undefined arguments to an empty object', () => {
    expect(normalizeMcpArguments(undefined)).toEqual({});
  });

  it('passes through top-level MCP arguments unchanged', () => {
    expect(normalizeMcpArguments({ query: 'MIT', limit: 5 })).toEqual({
      query: 'MIT',
      limit: 5,
    });
  });

  it('maps MCP auth statuses to stable messages', () => {
    expect(getMcpAuthErrorMessage('expired')).toBe('Expired MCP_API_KEY');
    expect(getMcpAuthErrorMessage('revoked')).toBe('Revoked MCP_API_KEY');
    expect(getMcpAuthErrorMessage('invalid')).toBe('Invalid MCP_API_KEY');
  });

  it('skips moderation for structured non-free-text tools', async () => {
    const moderation = {
      moderateOutput: jest.fn(),
    };

    const text = await serializeMcpToolContent(
      'search_schools',
      { success: true, result: { schools: ['MIT'] } },
      moderation,
    );

    expect(text).toContain('"schools"');
    expect(moderation.moderateOutput).not.toHaveBeenCalled();
  });

  it('returns sanitized content for moderated MCP tools', async () => {
    const moderation = {
      moderateOutput: jest.fn().mockResolvedValue({
        safe: false,
        flagged: true,
        categories: [],
        severity: 'LOW',
        action: ModerationAction.SANITIZE,
        sanitizedContent: 'sanitized',
        details: [],
      }),
    };

    const text = await serializeMcpToolContent(
      'generate_outline',
      { success: true, result: { hook: 'draft' } },
      moderation,
    );

    expect(text).toBe('sanitized');
  });

  it('blocks moderated MCP tool output when moderation requires it', async () => {
    const moderation = {
      moderateOutput: jest.fn().mockResolvedValue({
        safe: false,
        flagged: true,
        categories: [],
        severity: 'HIGH',
        action: ModerationAction.BLOCK,
        details: [],
      }),
    };

    const text = await serializeMcpToolContent(
      'create_timeline',
      { success: true, result: { timeline: [] } },
      moderation,
    );

    expect(text).toBe('Error: Tool output blocked by security check');
  });
});
