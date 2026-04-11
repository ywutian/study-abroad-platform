import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AgentType } from '@study-abroad/shared';
import { AiContextActions } from './AiContextActions';

const openFloatingAgentChat = vi.fn();

vi.mock('@/components/features/agent-chat/floating-chat-bridge', () => ({
  openFloatingAgentChat: (...args: unknown[]) => openFloatingAgentChat(...args),
}));

const messages = {
  prediction: {
    aiActions: {
      analyzeResults: 'Analyze results',
      analyzeResultsPrompt: 'Analyze {results}',
      improveChances: 'Improve chances',
      improveChancesPrompt: 'Improve {results}',
      analyzeSelectedSchools: 'Analyze selected schools',
      analyzeSelectedSchoolsPrompt: 'Analyze schools {schools}',
      recommendSchools: 'Recommend schools',
      recommendSchoolsPrompt: 'Recommend schools',
      applicationStrategy: 'Application strategy',
      applicationStrategyPrompt: 'Application strategy',
      explainModel: 'Explain model',
      explainModelPrompt: 'Explain model',
    },
    acceptanceRateLabel: 'Acceptance {rate}%',
    aiAssistantTitle: 'AI assistant',
    aiAssistantDescWithResults: 'Use AI with this prediction context.',
  },
};

describe('AiContextActions', () => {
  const results = [
    {
      schoolId: 'school-1',
      schoolName: 'MIT',
      probability: 0.42,
      confidence: 'high' as const,
      tier: 'match' as const,
      factors: [{ name: 'GPA', detail: 'Strong', impact: 'positive' as const }],
      suggestions: [],
      source: 'served',
      modelVersion: 'v3-enterprise',
      roundContext: 'ED',
      updatedAt: '2026-04-10T00:00:00.000Z',
    },
  ];

  const selectedSchools = [
    {
      id: 'school-1',
      name: 'MIT',
      usNewsRank: 2,
      acceptanceRate: 4.5,
    },
  ];

  beforeEach(() => {
    openFloatingAgentChat.mockReset();
  });

  it('uses selected-schools context for the analyze selected schools action', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiContextActions results={results} selectedSchools={selectedSchools} />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByText('Analyze selected schools'));

    expect(openFloatingAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        agentHint: AgentType.SCHOOL,
        context: expect.objectContaining({
          type: 'selected-schools',
          schools: [
            expect.objectContaining({
              id: 'school-1',
              prediction: expect.objectContaining({
                probability: 0.42,
                tier: 'match',
                confidence: 'high',
              }),
            }),
          ],
        }),
      })
    );
  });

  it('uses prediction-results context for analyze results', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiContextActions results={results} selectedSchools={selectedSchools} />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByText('Analyze results'));

    expect(openFloatingAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        agentHint: AgentType.SCHOOL,
        context: expect.objectContaining({
          type: 'prediction-results',
          results: [
            expect.objectContaining({
              schoolId: 'school-1',
              schoolName: 'MIT',
            }),
          ],
        }),
      })
    );
  });
});
