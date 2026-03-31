import { Test, TestingModule } from '@nestjs/testing';
import { ToolExecutorService } from './tool-executor.service';
import { ResilienceService } from './resilience.service';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { ToolName } from '../config/tools.config';
import { ToolCall, UserContext } from '../types';

// Domain tool services
import { ProfileToolsService } from '../tools/profile-tools.service';
import { SchoolToolsService } from '../tools/school-tools.service';
import { EssayToolsService } from '../tools/essay-tools.service';
import { RecommendationToolsService } from '../tools/recommendation-tools.service';
import { PredictionToolsService } from '../tools/prediction-tools.service';
import { CaseToolsService } from '../tools/case-tools.service';
import { TimelineToolsService } from '../tools/timeline-tools.service';
import { AssessmentToolsService } from '../tools/assessment-tools.service';
import { ForumToolsService } from '../tools/forum-tools.service';
import { RankingToolsService } from '../tools/ranking-tools.service';
import { SearchToolsService } from '../tools/search-tools.service';
import { ResumeToolsService } from '../tools/resume-tools.service';
import { SimilarityToolsService } from '../tools/similarity-tools.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToolCall(
  name: string,
  args: Record<string, unknown> = {},
  id = 'call-1',
): ToolCall {
  return { id, name, arguments: args };
}

function makeUserContext(overrides: Partial<UserContext> = {}): UserContext {
  return { userId: 'user-123', ...overrides };
}

function createMockProvider(handlers: Map<string, jest.Mock> = new Map()) {
  return { getHandlers: jest.fn().mockReturnValue(handlers) };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ToolExecutorService', () => {
  let service: ToolExecutorService;

  // Stable handler mocks — referenced by the handler Maps
  const profileHandler = jest.fn();
  const schoolHandler = jest.fn();

  // Stable mock objects created once (references survive across tests)
  const mockMetrics = {
    recordToolLatency: jest.fn(),
    recordError: jest.fn(),
  };

  const mockResilience = {
    withRetry: jest.fn(),
  };

  // Provider mocks — each holds a stable Map of handler references
  const profileHandlerMap = new Map<string, jest.Mock>([
    ['get_profile', profileHandler],
  ]);
  const schoolHandlerMap = new Map<string, jest.Mock>([
    ['search_schools', schoolHandler],
  ]);

  const mockProfileTools = createMockProvider(profileHandlerMap);
  const mockSchoolTools = createMockProvider(schoolHandlerMap);
  const mockEssayTools = createMockProvider();
  const mockRecommendationTools = createMockProvider();
  const mockPredictionTools = createMockProvider();
  const mockCaseTools = createMockProvider();
  const mockTimelineTools = createMockProvider();
  const mockAssessmentTools = createMockProvider();
  const mockForumTools = createMockProvider();
  const mockRankingTools = createMockProvider();
  const mockSearchTools = createMockProvider();
  const mockResumeTools = createMockProvider();
  const mockSimilarityTools = createMockProvider();

  beforeEach(async () => {
    // Reset call counts and implementations but keep object references
    profileHandler.mockReset();
    schoolHandler.mockReset();
    mockMetrics.recordToolLatency.mockReset();
    mockMetrics.recordError.mockReset();
    mockResilience.withRetry.mockReset();

    // Reset provider getHandlers call counts
    mockProfileTools.getHandlers.mockReset();
    mockSchoolTools.getHandlers.mockReset();
    mockEssayTools.getHandlers.mockReset();
    mockRecommendationTools.getHandlers.mockReset();
    mockPredictionTools.getHandlers.mockReset();
    mockCaseTools.getHandlers.mockReset();
    mockTimelineTools.getHandlers.mockReset();
    mockAssessmentTools.getHandlers.mockReset();
    mockForumTools.getHandlers.mockReset();
    mockRankingTools.getHandlers.mockReset();
    mockSearchTools.getHandlers.mockReset();
    mockResumeTools.getHandlers.mockReset();
    mockSimilarityTools.getHandlers.mockReset();

    // Default: withRetry delegates to the wrapped function
    mockResilience.withRetry.mockImplementation((fn: () => Promise<any>) =>
      fn(),
    );

    // Re-setup getHandlers return values (mockReset clears them)
    mockProfileTools.getHandlers.mockReturnValue(profileHandlerMap);
    mockSchoolTools.getHandlers.mockReturnValue(schoolHandlerMap);
    mockEssayTools.getHandlers.mockReturnValue(new Map());
    mockRecommendationTools.getHandlers.mockReturnValue(new Map());
    mockPredictionTools.getHandlers.mockReturnValue(new Map());
    mockCaseTools.getHandlers.mockReturnValue(new Map());
    mockTimelineTools.getHandlers.mockReturnValue(new Map());
    mockAssessmentTools.getHandlers.mockReturnValue(new Map());
    mockForumTools.getHandlers.mockReturnValue(new Map());
    mockRankingTools.getHandlers.mockReturnValue(new Map());
    mockSearchTools.getHandlers.mockReturnValue(new Map());
    mockResumeTools.getHandlers.mockReturnValue(new Map());
    mockSimilarityTools.getHandlers.mockReturnValue(new Map());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolExecutorService,
        { provide: ProfileToolsService, useValue: mockProfileTools },
        { provide: SchoolToolsService, useValue: mockSchoolTools },
        { provide: EssayToolsService, useValue: mockEssayTools },
        {
          provide: RecommendationToolsService,
          useValue: mockRecommendationTools,
        },
        { provide: PredictionToolsService, useValue: mockPredictionTools },
        { provide: CaseToolsService, useValue: mockCaseTools },
        { provide: TimelineToolsService, useValue: mockTimelineTools },
        { provide: AssessmentToolsService, useValue: mockAssessmentTools },
        { provide: ForumToolsService, useValue: mockForumTools },
        { provide: RankingToolsService, useValue: mockRankingTools },
        { provide: SearchToolsService, useValue: mockSearchTools },
        { provide: ResumeToolsService, useValue: mockResumeTools },
        { provide: SimilarityToolsService, useValue: mockSimilarityTools },
        { provide: MetricsService, useValue: mockMetrics },
        { provide: ResilienceService, useValue: mockResilience },
      ],
    }).compile();

    service = module.get<ToolExecutorService>(ToolExecutorService);
  });

  // ================================================================
  // Registry initialization (onModuleInit)
  // ================================================================
  describe('onModuleInit', () => {
    it('should collect handlers from all providers', () => {
      service.onModuleInit();

      expect(service.isToolAvailable('get_profile')).toBe(true);
      expect(service.isToolAvailable('search_schools')).toBe(true);
    });

    it('should report correct registered tools count', () => {
      service.onModuleInit();

      const stats = service.getStats();
      expect(stats.registeredTools).toBe(2);
    });

    it('should call getHandlers() on every provider', () => {
      service.onModuleInit();

      expect(mockProfileTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockSchoolTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockEssayTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockRecommendationTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockPredictionTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockCaseTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockTimelineTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockAssessmentTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockForumTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockRankingTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockSearchTools.getHandlers).toHaveBeenCalledTimes(1);
      expect(mockResumeTools.getHandlers).toHaveBeenCalledTimes(1);
    });

    it('should handle duplicate handler names without crashing', () => {
      // Make schoolTools also register 'get_profile'
      const duplicateHandler = jest.fn();
      mockSchoolTools.getHandlers.mockReturnValue(
        new Map([['get_profile', duplicateHandler]]),
      );

      service.onModuleInit();

      // Last registration wins — tool is still available
      expect(service.isToolAvailable('get_profile')).toBe(true);
    });
  });

  // ================================================================
  // execute — successful dispatch
  // ================================================================
  describe('execute — success', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should dispatch to the correct handler and return success result', async () => {
      const toolResult = { data: 'profile data' };
      profileHandler.mockResolvedValue(toolResult);

      const result = await service.execute(
        makeToolCall('get_profile', { fields: ['gpa'] }),
        'user-123',
        makeUserContext(),
        'en',
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual(toolResult);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(profileHandler).toHaveBeenCalledWith(
        { fields: ['gpa'] },
        'user-123',
        expect.objectContaining({ locale: 'en' }),
        'en',
      );
    });

    it('should record latency metric on success', async () => {
      profileHandler.mockResolvedValue({ ok: true });

      await service.execute(
        makeToolCall('get_profile'),
        'user-123',
        makeUserContext(),
      );

      expect(mockMetrics.recordToolLatency).toHaveBeenCalledWith(
        'get_profile',
        expect.any(Number),
      );
    });

    it('should default locale to zh when not provided', async () => {
      profileHandler.mockResolvedValue({});

      await service.execute(
        makeToolCall('get_profile'),
        'user-123',
        makeUserContext(),
      );

      expect(profileHandler).toHaveBeenCalledWith(
        expect.anything(),
        'user-123',
        expect.objectContaining({ locale: 'zh' }),
        'zh',
      );
    });
  });

  // ================================================================
  // execute — unknown tool
  // ================================================================
  describe('execute — unknown tool', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should return failure with descriptive error', async () => {
      const result = await service.execute(
        makeToolCall('nonexistent_tool'),
        'user-123',
        makeUserContext(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: nonexistent_tool');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ================================================================
  // execute — handler errors
  // ================================================================
  describe('execute — handler error', () => {
    beforeEach(() => {
      service.onModuleInit();
      // Make withRetry propagate errors (like the real implementation)
      mockResilience.withRetry.mockImplementation((fn: () => Promise<any>) =>
        fn(),
      );
    });

    it('should catch thrown Error and return failure', async () => {
      profileHandler.mockRejectedValue(new Error('Database connection lost'));

      const result = await service.execute(
        makeToolCall('get_profile'),
        'user-123',
        makeUserContext(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection lost');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should record error metric on failure', async () => {
      profileHandler.mockRejectedValue(new Error('timeout'));

      await service.execute(
        makeToolCall('get_profile'),
        'user-123',
        makeUserContext(),
      );

      expect(mockMetrics.recordError).toHaveBeenCalledWith(
        'tool_execution_failed',
        'get_profile',
      );
    });

    it('should handle non-Error throws gracefully', async () => {
      profileHandler.mockRejectedValue('string error');

      const result = await service.execute(
        makeToolCall('get_profile'),
        'user-123',
        makeUserContext(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should return failure when handler returns an error result object', async () => {
      profileHandler.mockResolvedValue({
        success: false,
        error: 'Profile not found',
      });

      const result = await service.execute(
        makeToolCall('get_profile'),
        'user-123',
        makeUserContext(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Profile not found');
    });
  });

  // ================================================================
  // execute — DELEGATE_TO_AGENT special handling
  // ================================================================
  describe('execute — DELEGATE_TO_AGENT', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should return delegation result for a valid agent', async () => {
      const result = await service.execute(
        makeToolCall(ToolName.DELEGATE_TO_AGENT, {
          agent: 'essay',
          task: 'Review my essay',
          context: { essayId: '123' },
        }),
        'user-123',
        makeUserContext(),
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        _delegation: true,
        targetAgent: 'essay',
        task: 'Review my essay',
        context: { essayId: '123' },
      });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should not use retry for delegation', async () => {
      await service.execute(
        makeToolCall(ToolName.DELEGATE_TO_AGENT, {
          agent: 'school',
          task: 'Find schools',
        }),
        'user-123',
        makeUserContext(),
      );

      expect(mockResilience.withRetry).not.toHaveBeenCalled();
    });

    it('should reject invalid agent name', async () => {
      const result = await service.execute(
        makeToolCall(ToolName.DELEGATE_TO_AGENT, {
          agent: 'invalid_agent',
          task: 'Do something',
        }),
        'user-123',
        makeUserContext(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid agent: invalid_agent');
      expect(result.error).toContain('Valid agents:');
    });

    it('should reject when agent is missing', async () => {
      const result = await service.execute(
        makeToolCall(ToolName.DELEGATE_TO_AGENT, { task: 'Do something' }),
        'user-123',
        makeUserContext(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid agent');
    });

    it('should accept all valid agent types', async () => {
      const validAgents = ['essay', 'school', 'profile', 'timeline', 'resume'];

      for (const agent of validAgents) {
        const result = await service.execute(
          makeToolCall(ToolName.DELEGATE_TO_AGENT, { agent, task: 'test' }),
          'user-123',
          makeUserContext(),
        );
        expect(result.success).toBe(true);
        expect((result.result as any).targetAgent).toBe(agent);
      }
    });
  });

  // ================================================================
  // execute — retry behavior
  // ================================================================
  describe('execute — retry behavior', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should use withRetry for retryable tools', async () => {
      schoolHandler.mockResolvedValue({ schools: [] });

      await service.execute(
        makeToolCall('search_schools', { query: 'MIT' }),
        'user-123',
        makeUserContext(),
      );

      expect(mockResilience.withRetry).toHaveBeenCalledTimes(1);
      expect(mockResilience.withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxAttempts: 2,
          baseDelayMs: 500,
          maxDelayMs: 2000,
        }),
      );
    });

    it('should NOT use withRetry for UPDATE_PROFILE (non-retryable)', async () => {
      const updateHandler = jest.fn().mockResolvedValue({ updated: true });
      mockProfileTools.getHandlers.mockReturnValue(
        new Map<string, jest.Mock>([
          ['get_profile', profileHandler],
          [ToolName.UPDATE_PROFILE, updateHandler],
        ]),
      );
      service.onModuleInit();

      await service.execute(
        makeToolCall(ToolName.UPDATE_PROFILE, { gpa: 3.9 }),
        'user-123',
        makeUserContext(),
      );

      expect(mockResilience.withRetry).not.toHaveBeenCalled();
      expect(updateHandler).toHaveBeenCalled();
    });

    it('should NOT use withRetry for POLISH_ESSAY (non-retryable)', async () => {
      const polishHandler = jest.fn().mockResolvedValue({ polished: true });
      mockEssayTools.getHandlers.mockReturnValue(
        new Map([[ToolName.POLISH_ESSAY, polishHandler]]),
      );
      service.onModuleInit();

      await service.execute(
        makeToolCall(ToolName.POLISH_ESSAY, { essayId: '1' }),
        'user-123',
        makeUserContext(),
      );

      expect(mockResilience.withRetry).not.toHaveBeenCalled();
    });

    it('should NOT use withRetry for CREATE_PERSONAL_EVENT (non-retryable)', async () => {
      const createHandler = jest.fn().mockResolvedValue({ created: true });
      mockTimelineTools.getHandlers.mockReturnValue(
        new Map([[ToolName.CREATE_PERSONAL_EVENT, createHandler]]),
      );
      service.onModuleInit();

      await service.execute(
        makeToolCall(ToolName.CREATE_PERSONAL_EVENT, { title: 'Test' }),
        'user-123',
        makeUserContext(),
      );

      expect(mockResilience.withRetry).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // execute — without optional services
  // ================================================================
  describe('execute — without MetricsService and ResilienceService', () => {
    let bareService: ToolExecutorService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ToolExecutorService,
          { provide: ProfileToolsService, useValue: mockProfileTools },
          { provide: SchoolToolsService, useValue: mockSchoolTools },
          { provide: EssayToolsService, useValue: mockEssayTools },
          {
            provide: RecommendationToolsService,
            useValue: mockRecommendationTools,
          },
          { provide: PredictionToolsService, useValue: mockPredictionTools },
          { provide: CaseToolsService, useValue: mockCaseTools },
          { provide: TimelineToolsService, useValue: mockTimelineTools },
          { provide: AssessmentToolsService, useValue: mockAssessmentTools },
          { provide: ForumToolsService, useValue: mockForumTools },
          { provide: RankingToolsService, useValue: mockRankingTools },
          { provide: SearchToolsService, useValue: mockSearchTools },
          { provide: ResumeToolsService, useValue: mockResumeTools },
          { provide: SimilarityToolsService, useValue: mockSimilarityTools },
          // Intentionally omit MetricsService and ResilienceService
        ],
      }).compile();

      bareService = module.get<ToolExecutorService>(ToolExecutorService);
      bareService.onModuleInit();
    });

    it('should execute directly (no retry) when ResilienceService is absent', async () => {
      profileHandler.mockResolvedValue({ data: 'ok' });

      const result = await bareService.execute(
        makeToolCall('get_profile'),
        'user-123',
        makeUserContext(),
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: 'ok' });
    });

    it('should not throw when MetricsService is absent on success', async () => {
      profileHandler.mockResolvedValue({ data: 'ok' });

      await expect(
        bareService.execute(
          makeToolCall('get_profile'),
          'user-123',
          makeUserContext(),
        ),
      ).resolves.toEqual(expect.objectContaining({ success: true }));
    });

    it('should not throw when MetricsService is absent on error', async () => {
      profileHandler.mockRejectedValue(new Error('fail'));

      const result = await bareService.execute(
        makeToolCall('get_profile'),
        'user-123',
        makeUserContext(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('fail');
    });
  });

  // ================================================================
  // executeAll
  // ================================================================
  describe('executeAll', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should execute multiple tool calls and return results keyed by id', async () => {
      profileHandler.mockResolvedValue({ name: 'John' });
      schoolHandler.mockResolvedValue({ schools: ['MIT'] });

      const results = await service.executeAll(
        [
          makeToolCall('get_profile', {}, 'call-1'),
          makeToolCall('search_schools', { q: 'MIT' }, 'call-2'),
        ],
        'user-123',
        makeUserContext(),
      );

      expect(results.size).toBe(2);
      expect(results.get('call-1')?.success).toBe(true);
      expect(results.get('call-1')?.result).toEqual({ name: 'John' });
      expect(results.get('call-2')?.success).toBe(true);
      expect(results.get('call-2')?.result).toEqual({ schools: ['MIT'] });
    });

    it('should handle mixed success and failure', async () => {
      profileHandler.mockResolvedValue({ name: 'John' });

      const results = await service.executeAll(
        [
          makeToolCall('get_profile', {}, 'call-1'),
          makeToolCall('unknown_tool', {}, 'call-2'),
        ],
        'user-123',
        makeUserContext(),
      );

      expect(results.get('call-1')?.success).toBe(true);
      expect(results.get('call-2')?.success).toBe(false);
      expect(results.get('call-2')?.error).toBe('Unknown tool: unknown_tool');
    });

    it('should return empty map for empty input', async () => {
      const results = await service.executeAll(
        [],
        'user-123',
        makeUserContext(),
      );

      expect(results.size).toBe(0);
    });
  });

  // ================================================================
  // isToolAvailable
  // ================================================================
  describe('isToolAvailable', () => {
    it('should return false before initialization', () => {
      expect(service.isToolAvailable('get_profile')).toBe(false);
    });

    it('should return true for registered tools after init', () => {
      service.onModuleInit();
      expect(service.isToolAvailable('get_profile')).toBe(true);
    });

    it('should return false for unregistered tools', () => {
      service.onModuleInit();
      expect(service.isToolAvailable('does_not_exist')).toBe(false);
    });
  });

  // ================================================================
  // getStats
  // ================================================================
  describe('getStats', () => {
    it('should return 0 registered tools before init', () => {
      const stats = service.getStats();
      expect(stats.registeredTools).toBe(0);
      expect(stats.totalCalls).toBe(0);
      expect(stats.avgDuration).toBe(0);
    });

    it('should return correct count after init', () => {
      service.onModuleInit();
      expect(service.getStats().registeredTools).toBe(2);
    });
  });

  // ================================================================
  // Legacy context conversion
  // ================================================================
  describe('context conversion', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should pass profile and preference fields via legacy context', async () => {
      profileHandler.mockResolvedValue({});

      const context = makeUserContext({
        profile: {
          gpa: 3.8,
          gpaScale: 4.0,
          testScores: [{ type: 'SAT', score: 1500 }],
          targetMajor: 'CS',
          targetSchools: ['MIT'],
          budgetTier: 'high',
        } as any,
        preferences: {
          schoolSize: 'medium',
          location: 'northeast',
          climate: 'cold',
        } as any,
      });

      await service.execute(
        makeToolCall('get_profile'),
        'user-123',
        context,
        'en',
      );

      const passedContext = profileHandler.mock.calls[0][2];
      expect(passedContext.profile.gpa).toBe(3.8);
      expect(passedContext.profile.gpaScale).toBe(4.0);
      expect(passedContext.profile.targetMajor).toBe('CS');
      expect(passedContext.preferences.schoolSize).toBe('medium');
      expect(passedContext.locale).toBe('en');
    });

    it('should handle missing profile and preferences gracefully', async () => {
      profileHandler.mockResolvedValue({});

      await service.execute(
        makeToolCall('get_profile'),
        'user-123',
        makeUserContext(),
        'zh',
      );

      const passedContext = profileHandler.mock.calls[0][2];
      expect(passedContext.profile).toBeUndefined();
      expect(passedContext.preferences).toBeUndefined();
      expect(passedContext.locale).toBe('zh');
    });
  });
});
