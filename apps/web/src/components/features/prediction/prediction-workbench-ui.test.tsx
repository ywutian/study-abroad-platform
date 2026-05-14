import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { PortfolioDiagnosisCard } from './PortfolioDiagnosisCard';
import { ProfileSnapshotBar } from './ProfileSnapshotBar';

const messages = {
  prediction: {
    profileSnapshot: {
      title: 'Profile snapshot',
      subtitle: 'This estimate uses these application details first.',
      ready: 'Profile looks ready',
      usable: 'Ready for a first estimate',
      missing: 'Missing {item}',
      adjust: 'Adjust inputs',
      gpa: 'GPA',
      tests: 'SAT / ACT',
      language: 'Language score',
      signals: 'Activities & awards',
      empty: 'Not filled',
      optional: 'Optional',
      addGpa: 'Add GPA for a steadier read',
      addTests: 'Add scores or mark test optional',
      languageOptional: 'Recommended for international applicants',
      addSignals: 'Activities and awards affect fit',
      academicBase: 'Academic baseline',
      testBase: 'Testing baseline',
      languageBase: 'Language baseline',
      signalsBase: 'Application signals',
      signalsValue: '{activities} activities / {awards} awards / {advanced} advanced',
    },
    diagnosis: {
      title: 'School-list diagnosis',
      subtitle: 'Check balance first, then decide whether to rerun or add schools.',
      mix: 'Reach/match/safety',
      average: 'Average chance',
      healthLabel: 'List status',
      health: {
        ready: 'Healthy',
        attention: 'Needs tuning',
        blocked: 'Run first',
      },
      reachCount: '{count} reach',
      matchCount: '{count} match',
      safetyCount: '{count} safety',
      missingCount: '{count} not estimated',
      recommendation: 'List advice',
      watchout: 'Watch-out',
      recommendations: {
        runFirst: 'Run an estimate first so the workbench can read the actual list shape.',
        addSafety: 'You do not have a safety school yet. Add 1-2 higher-probability options.',
        addMatch: 'You are light on match schools. Add a few schools in the middle range.',
        reachHeavy:
          'Reach schools are about {reachRatio}% of the list, so the plan is risky. Add more match or safety options.',
        balanced:
          'Reach, match, and safety are reasonably balanced. Review individual cards for next steps.',
      },
      alerts: {
        selectMore:
          'Select several target schools before running; portfolio advice gets more useful with a real list.',
        noSafety: 'Without safety schools, outcomes can swing more than expected.',
        noMatch: 'Without match schools, the list can jump from reach to safety with no middle.',
        reachRisk: 'A reach-heavy list should not be treated as the final application plan.',
        hasStale: '{stale} estimates are older than 30 days and should be rerun.',
        healthy: 'This batch is fresh enough to compare individual school reasons.',
      },
    },
  },
};

function renderWithIntl(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('prediction workbench UI', () => {
  it('renders profile inputs as an applicant-facing snapshot', () => {
    renderWithIntl(
      <ProfileSnapshotBar
        profile={{
          gpa: 3.95,
          testScores: [{ type: 'SAT', score: 1520 }],
          toefl: 115,
          activities: [{ id: 'a1' }],
          awards: [{ id: 'w1' }],
          advancedCourses: [{ id: 'ap1' }],
        }}
        completeness={100}
        hasProfileGaps={false}
      />
    );

    expect(screen.getByText('Profile snapshot')).toBeInTheDocument();
    expect(screen.getByText('3.95')).toBeInTheDocument();
    expect(screen.getByText('1520')).toBeInTheDocument();
    expect(screen.getByText('115')).toBeInTheDocument();
    expect(screen.getByText('1 activities / 1 awards / 1 advanced')).toBeInTheDocument();
    expect(screen.queryByText(/\bAI\b/)).not.toBeInTheDocument();
  });

  it('surfaces a plain-language portfolio warning when reach schools dominate', () => {
    renderWithIntl(
      <PortfolioDiagnosisCard
        selectedCount={4}
        predictions={[
          { probability: 0.08, tier: 'reach' },
          { probability: 0.12, tier: 'reach' },
          { probability: 0.18, tier: 'reach' },
          { probability: 0.72, tier: 'safety' },
        ]}
      />
    );

    expect(screen.getByText('School-list diagnosis')).toBeInTheDocument();
    expect(screen.getByText('3/0/1')).toBeInTheDocument();
    expect(screen.getByText('Needs tuning')).toBeInTheDocument();
    expect(screen.getByText(/Reach schools are about 75%/)).toBeInTheDocument();
  });
});
