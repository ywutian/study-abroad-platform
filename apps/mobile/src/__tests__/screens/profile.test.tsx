import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.percentage ? `${key}:${options.percentage}` : key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/components/ui', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    Button: ({ children, onPress }: any) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Avatar: ({ name }: any) => <Text>{name}</Text>,
    Badge: ({ children }: any) => <Text>{children}</Text>,
    Loading: () => <Text>Loading</Text>,
    EmptyState: ({ title, description }: any) => (
      <View>
        <Text>{title}</Text>
        <Text>{description}</Text>
      </View>
    ),
    ConfirmDialog: () => null,
    Card: ({ children, onPress, accessibilityLabel }: any) => (
      <TouchableOpacity onPress={onPress} accessibilityLabel={accessibilityLabel}>
        <View>{children}</View>
      </TouchableOpacity>
    ),
    CardContent: ({ children }: any) => <View>{children}</View>,
    CardHeader: ({ children }: any) => <View>{children}</View>,
    CardTitle: ({ children }: any) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/ListItem', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    ListItem: ({ title, onPress, rightElement }: any) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{title}</Text>
        {rightElement}
      </TouchableOpacity>
    ),
    ListGroup: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@/components/ui/Progress', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    CircularProgress: () => <Text>CircularProgress</Text>,
  };
});

jest.mock('@/stores', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: '1', email: 'test@example.com', role: 'USER' },
    isAuthenticated: true,
    logout: jest.fn(),
  })),
  useThemeStore: jest.fn(() => ({
    colorScheme: 'light',
  })),
}));

import { router } from 'expo-router';
import { apiClient } from '@/lib/api/client';
import ProfileScreen from '@/app/(tabs)/profile';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the application analysis summary card on profile', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/profiles/me/ai-analysis')) {
        return Promise.resolve({
          status: 'fresh',
          meta: {
            traceId: 'trace-profile-1',
            analysisVersion: 'application-analysis-v2',
            state: 'ready',
            dataQuality: 'high',
            targetSchoolCount: 3,
            focusSchoolCount: 2,
            schoolsWithPredictions: 2,
            generatedAt: '2026-04-10T12:00:00.000Z',
          },
          profileSummary: {
            applicantType: 'international',
            intendedMajors: ['Computer Science'],
            testStrategy: 'submit',
            contextFlags: ['needAid'],
            constraints: ['International aid need remains a hard structural constraint.'],
          },
          portfolioSummary: {
            balance: 'balanced',
            verdict: 'The current list is ambitious but still defensible.',
            keyReasons: ['Academic baseline is strong enough for the current list.'],
            riskBoundaries: ['International aid need narrows the margin.'],
          },
          schools: [
            {
              schoolId: 'school-1',
              schoolName: 'Example University',
              tier: 'REACH',
              round: 'ED',
              prediction: {
                probability: 0.29,
                confidence: 'medium',
                updatedAt: '2026-04-10T12:00:00.000Z',
              },
              policyCard: {
                testingPolicy: 'OPTIONAL',
                intlAidPolicy: 'NEED_AWARE',
                roundContext: 'ED',
                policySourceQuality: 'REVIEWED',
                evidenceIds: ['evidence-1'],
                sources: [],
                unknowns: [],
              },
              assessment: {
                summary: 'This remains a high-variance reach school.',
                whyThisIsHard: ['Acceptance margin remains narrow.'],
                compensatingStrengths: ['Academic baseline travels well.'],
                topGaps: ['Leadership signal still needs sharper differentiation.'],
                nextActions: ['Clarify one flagship activity outcome.'],
                historicalSignals: ['Historical sample is thin.'],
                hardStopRisks: ['International aid need reduces flexibility.'],
              },
              evidenceIds: ['evidence-1'],
              unknowns: [],
            },
            {
              schoolId: 'school-2',
              schoolName: 'Second University',
              tier: 'TARGET',
              policyCard: {
                testingPolicy: 'BLIND',
                intlAidPolicy: 'UNKNOWN',
                roundContext: 'RD',
                policySourceQuality: 'DERIVED',
                evidenceIds: ['evidence-2'],
                sources: [],
                unknowns: [],
              },
              assessment: {
                summary: 'This school is more rangeable with the current file.',
                whyThisIsHard: ['Still competitive for the chosen major.'],
                compensatingStrengths: ['Course rigor is aligned.'],
                topGaps: ['Extracurricular spike is still limited.'],
                nextActions: ['Improve activity narrative.'],
                historicalSignals: ['Comparable admits usually had stronger narrative cohesion.'],
                hardStopRisks: [],
              },
              evidenceIds: ['evidence-2'],
              unknowns: [],
            },
          ],
          actionPlan: {
            now: ['Lock one clear flagship activity story.'],
            next90Days: ['Build measurable leadership output.'],
            beforeSubmission: ['Align essays to the school list.'],
          },
          unknowns: [],
        });
      }
      if (url.includes('/verification/status')) {
        return Promise.resolve({ emailVerified: true, identityVerified: false });
      }
      if (url.includes('/points/balance')) {
        return Promise.resolve({ balance: 12, level: 'free' });
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({
          visibility: 'PRIVATE',
          testScores: [],
          activities: [],
          awards: [],
          education: [],
          essays: [],
        });
      }
      return Promise.resolve({});
    });

    const { findByText } = renderWithProviders(<ProfileScreen />);

    expect(await findByText('applicationAnalysis.summaryCard.title')).toBeTruthy();
    expect(await findByText('The current list is ambitious but still defensible.')).toBeTruthy();
    expect(await findByText('trace-pr')).toBeTruthy();
  });

  it('navigates to /profile/analysis from the summary card', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/profiles/me/ai-analysis')) {
        return Promise.resolve({
          status: 'fresh',
          meta: {
            traceId: 'trace-profile-2',
            analysisVersion: 'application-analysis-v2',
            state: 'ready',
            dataQuality: 'high',
            targetSchoolCount: 1,
            focusSchoolCount: 1,
            schoolsWithPredictions: 1,
            generatedAt: '2026-04-10T12:00:00.000Z',
          },
          profileSummary: {
            applicantType: 'domestic',
            intendedMajors: ['Economics'],
            testStrategy: 'testOptional',
            contextFlags: ['testOptional'],
            constraints: [],
          },
          portfolioSummary: {
            balance: 'balanced',
            verdict: 'Summary verdict',
            keyReasons: ['One school already has usable policy evidence.'],
            riskBoundaries: [],
          },
          schools: [
            {
              schoolId: 'school-1',
              schoolName: 'Example University',
              tier: 'TARGET',
              policyCard: {
                testingPolicy: 'OPTIONAL',
                intlAidPolicy: 'UNKNOWN',
                roundContext: 'RD',
                policySourceQuality: 'REVIEWED',
                evidenceIds: ['evidence-1'],
                sources: [],
                unknowns: [],
              },
              assessment: {
                summary: 'Summary',
                whyThisIsHard: ['Still selective.'],
                compensatingStrengths: ['Transcript is stable.'],
                topGaps: ['Narrative needs more precision.'],
                nextActions: ['Sharpen school-specific messaging.'],
                historicalSignals: ['Comparable cases converted with stronger positioning.'],
                hardStopRisks: [],
              },
              evidenceIds: ['evidence-1'],
              unknowns: [],
            },
          ],
          actionPlan: {
            now: ['Sharpen one school-specific positioning angle.'],
            next90Days: [],
            beforeSubmission: [],
          },
          unknowns: [],
        });
      }
      if (url.includes('/verification/status')) {
        return Promise.resolve({ emailVerified: true, identityVerified: false });
      }
      if (url.includes('/points/balance')) {
        return Promise.resolve({ balance: 12, level: 'free' });
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({
          visibility: 'PRIVATE',
          testScores: [],
          activities: [],
          awards: [],
          education: [],
          essays: [],
        });
      }
      return Promise.resolve({});
    });

    const { findByLabelText } = renderWithProviders(<ProfileScreen />);

    fireEvent.press(await findByLabelText('applicationAnalysis.summaryCard.open'));

    expect(router.push).toHaveBeenCalledWith('/profile/analysis');
  });
});
