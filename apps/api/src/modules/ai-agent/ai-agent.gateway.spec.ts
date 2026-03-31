/**
 * AiAgentGateway 单元测试
 *
 * 最小 TestingModule：仅覆盖 PromptGuard 必注入与 blocked/not-blocked 两个分支
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AiAgentGateway } from './ai-agent.gateway';
import { OrchestratorService } from './core/orchestrator.service';
import { MemoryManagerService } from './memory/memory-manager.service';
import { PromptGuardService } from './security/prompt-guard.service';

describe('AiAgentGateway', () => {
  let gateway: AiAgentGateway;
  let promptGuard: jest.Mocked<PromptGuardService>;

  const mockPromptGuardResult = {
    safe: true,
    riskScore: 0,
    threats: [],
    sanitizedInput: undefined,
    blocked: false,
    reason: undefined,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAgentGateway,
        {
          provide: OrchestratorService,
          useValue: {
            handleMessageStream: jest.fn(),
            handleMessage: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue({ sub: 'user_1' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: MemoryManagerService,
          useValue: {
            getConversationHistory: jest.fn().mockResolvedValue([]),
            getConversationList: jest.fn().mockResolvedValue([]),
            clearConversation: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PromptGuardService,
          useValue: {
            analyze: jest.fn().mockResolvedValue({ ...mockPromptGuardResult }),
          },
        },
      ],
    }).compile();

    gateway = module.get<AiAgentGateway>(AiAgentGateway);
    promptGuard = module.get(PromptGuardService);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleSendMessage - PromptGuard', () => {
    const mockClient = {
      userId: 'user_1',
      id: 'socket_1',
      emit: jest.fn(),
    } as any;

    it('should allow message when not blocked', async () => {
      promptGuard.analyze.mockResolvedValue({
        ...mockPromptGuardResult,
        blocked: false,
      });

      const result = await gateway.handleSendMessage(mockClient, {
        message: 'Hello AI',
      });

      expect(promptGuard.analyze).toHaveBeenCalledWith('Hello AI', {
        userId: 'user_1',
        strictMode: false,
      });
      // Not blocked → should not return error
      expect(result).not.toEqual(
        expect.objectContaining({ error: 'Input blocked by security check' }),
      );
    });

    it('should block message when PromptGuard flags it', async () => {
      promptGuard.analyze.mockResolvedValue({
        ...mockPromptGuardResult,
        blocked: true,
        reason: 'Injection attempt detected',
      });

      const result = await gateway.handleSendMessage(mockClient, {
        message: 'malicious input',
      });

      expect(promptGuard.analyze).toHaveBeenCalled();
      expect(mockClient.emit).toHaveBeenCalledWith('aiError', {
        error: '输入内容包含不安全的模式',
        code: 'SECURITY_BLOCK',
      });
      expect(result).toEqual({
        success: false,
        error: 'Input blocked by security check',
      });
    });

    it('should reject unauthorized client', async () => {
      const unauthClient = { id: 'socket_2', emit: jest.fn() } as any;

      const result = await gateway.handleSendMessage(unauthClient, {
        message: 'test',
      });

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
      expect(promptGuard.analyze).not.toHaveBeenCalled();
    });

    it('should reject empty message', async () => {
      const result = await gateway.handleSendMessage(mockClient, {
        message: '',
      });

      expect(result).toEqual({ success: false, error: 'Invalid message' });
      expect(promptGuard.analyze).not.toHaveBeenCalled();
    });
  });
});
