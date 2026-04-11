import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { ToolCallCard } from './tool-call-card';

const messages = {
  agentChat: {
    tools: {
      searchSchools: 'Search Schools',
      getProfile: 'Get Profile',
      analyzeProfile: 'Analyze Profile',
      searchCases: 'Search Cases',
      getDeadlines: 'Get Deadlines',
      reviewEssay: 'Review Essay',
      queryDatabase: 'Query Database',
      generateOutline: 'Generate Outline',
      recommendSchools: 'Recommend Schools',
      analyzeChance: 'Analyze Chances',
      predictionHistory: 'Prediction History',
      predictionDashboard: 'Prediction Dashboard',
      schoolListPredictions: 'School List Predictions',
      predictionTrace: 'Prediction Trace Summary',
    },
    toolPreview: {
      probability: 'Probability',
      tier: 'Tier',
      confidence: 'Confidence',
      historyPoints: 'History',
      schools: 'Schools',
      predicted: 'Predicted',
      avgProbability: 'Avg. Probability',
      sources: 'Sources',
      uncertainty: 'Uncertainty',
      round: 'Round',
      updated: 'Updated',
      notAvailable: 'N/A',
      noPublicTrace: 'No public trace summary',
    },
  },
  prediction: {
    tier: {
      reach: 'Reach',
      match: 'Match',
      safety: 'Safety',
    },
  },
};

describe('ToolCallCard', () => {
  it('renders structured preview for analyze_admission_chance results', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ToolCallCard
          tool={{
            name: 'analyze_admission_chance',
            status: 'completed',
            result: {
              success: true,
              result: {
                school: { id: 'school-1', name: 'MIT' },
                probability: 0.42,
                tier: 'match',
                confidence: 'high',
                confidenceReason: 'Strong profile alignment with the current round context.',
              },
            },
          }}
          isUser={false}
          index={0}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Analyze Chances')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('Match')).toBeInTheDocument();
    expect(
      screen.getByText('Strong profile alignment with the current round context.')
    ).toBeInTheDocument();
  });

  it('renders trace summary preview counts', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ToolCallCard
          tool={{
            name: 'get_prediction_trace_summary',
            status: 'completed',
            result: {
              success: true,
              result: {
                school: { id: 'school-1', name: 'Stanford' },
                trace: {
                  roundContext: 'ED',
                  sourceSummary: [{ label: 'IPEDS baseline' }, { label: 'Round adjustment' }],
                  uncertaintyReasons: ['Round-specific public data is limited.'],
                  confidenceReason:
                    'The model has good baseline coverage but limited ED-specific public data.',
                  updatedAt: '2026-04-10T00:00:00.000Z',
                },
              },
            },
          }}
          isUser={false}
          index={0}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Prediction Trace Summary')).toBeInTheDocument();
    expect(screen.getByText('Stanford')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(
      screen.getByText('The model has good baseline coverage but limited ED-specific public data.')
    ).toBeInTheDocument();
  });

  it('renders prediction history preview', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ToolCallCard
          tool={{
            name: 'get_prediction_history',
            status: 'completed',
            result: {
              success: true,
              result: {
                school: { id: 'school-1', name: 'MIT' },
                current: {
                  probability: 0.42,
                  tier: 'match',
                  updatedAt: '2026-04-10T00:00:00.000Z',
                },
                history: [{ probability: 0.38 }, { probability: 0.41 }],
              },
            },
          }}
          isUser={false}
          index={0}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Prediction History')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('Match')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders prediction dashboard preview', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ToolCallCard
          tool={{
            name: 'get_prediction_dashboard',
            status: 'completed',
            result: {
              success: true,
              result: {
                totalSchools: 2,
                avgProbability: 47,
                predictions: [
                  {
                    schoolId: 'school-1',
                    school: { id: 'school-1', name: 'MIT' },
                    probability: 0.42,
                  },
                  {
                    schoolId: 'school-2',
                    school: { id: 'school-2', name: 'Stanford' },
                    probability: 0.51,
                  },
                ],
              },
            },
          }}
          isUser={false}
          index={0}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Prediction Dashboard')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByText('Stanford')).toBeInTheDocument();
    expect(screen.getByText('47%')).toBeInTheDocument();
  });

  it('renders school list prediction preview', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ToolCallCard
          tool={{
            name: 'get_school_list_predictions',
            status: 'completed',
            result: {
              success: true,
              result: [
                {
                  schoolId: 'school-1',
                  school: { id: 'school-1', name: 'MIT' },
                  prediction: { probability: 0.42 },
                },
                {
                  schoolId: 'school-2',
                  school: { id: 'school-2', name: 'Stanford' },
                  prediction: { probability: 0.51 },
                },
              ],
            },
          }}
          isUser={false}
          index={0}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('School List Predictions')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByText('Stanford')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('51%')).toBeInTheDocument();
  });
});
