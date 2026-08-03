jest.mock('@/lib/api/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

import { AI_REQUEST_TIMEOUT_MS, API_ROUTES, AgentType } from '@study-abroad/shared';
import { profileRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { aiService } from '@/lib/api/services/ai';

describe('aiService.chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.post as jest.Mock).mockResolvedValue({ ok: true });
  });

  it('serializes context and agentHint into the chat request', async () => {
    await aiService.chat('Analyze these predictions', {
      conversationId: 'conv-1',
      locale: 'en',
      stream: false,
      agentHint: AgentType.SCHOOL,
      context: {
        type: 'prediction-results',
        source: 'prediction_page',
        results: [
          {
            schoolId: 'school-1',
            schoolName: 'MIT',
            probability: 0.42,
            tier: 'match',
            confidence: 'high',
          },
        ],
        summary: {
          total: 1,
          reach: 0,
          match: 1,
          safety: 0,
          avgProbability: 0.42,
        },
      },
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      `${API_ROUTES.AI_AGENT}/chat`,
      expect.objectContaining({
        message: 'Analyze these predictions',
        conversationId: 'conv-1',
        locale: 'en',
        stream: false,
        agentHint: AgentType.SCHOOL,
        context: expect.objectContaining({
          type: 'prediction-results',
          source: 'prediction_page',
        }),
      }),
      { timeout: AI_REQUEST_TIMEOUT_MS }
    );
  });

  it('uses the canonical /profiles/me/ai-analysis route for application analysis', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ status: 'fresh' });

    await aiService.profileAnalysis();

    expect(apiClient.get).toHaveBeenCalledWith(profileRoutes.aiAnalysis(), {
      timeout: AI_REQUEST_TIMEOUT_MS,
      retries: 0,
    });
  });
});
