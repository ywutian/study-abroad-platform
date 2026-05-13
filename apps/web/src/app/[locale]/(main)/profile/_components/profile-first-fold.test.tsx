import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProfileActionBar } from './profile-header';
import { ProfileTabNav } from './ProfileTabNav';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const labels: Record<string, string> = {
      'profile.gpa': 'GPA',
      'profile.testScores': 'Test Scores',
      'profile.activities': 'Activities',
      'profile.awards': 'Awards',
      'profile.fields.targetMajor': 'Target Major',
      'profile.readiness.title': 'Profile Readiness',
      'profile.readiness.highImpact': 'Improves prediction quality',
      'profile.readiness.mediumImpact': 'Improves recommendation ranking',
      'profile.readiness.recommendationImpact': 'Improves major and school fit',
      'profile.readiness.reviewTargets': 'Review target schools',
      'profile.readiness.allSet': 'Core profile signals are ready.',
      'profile.actionBar.nextStep': 'Next: {signal}',
      'profile.actionBar.completeSignal': 'Complete {signal}',
      'profile.actionBar.readyForAnalysis': 'Ready for analysis',
      'profile.nextSteps.applicationHub': 'Application Hub',
      'profile.nextSteps.prediction': 'Admission Prediction',
      'profile.exportResume': 'Export Resume',
      'profile.title': 'Profile',
      'profile.steps.basic': 'Basic Info',
      'profile.steps.demographics': 'Background',
      'profile.steps.scores': 'Test Scores',
      'profile.steps.gpa': 'GPA',
      'profile.steps.activities': 'Activities',
      'profile.steps.awards': 'Awards',
      'profile.steps.targets': 'Target Schools',
      'profile.steps.recLetters': 'Rec Letters',
      'profile.steps.privacy': 'Privacy',
      'profile.tabStatus.complete': 'Complete',
      'profile.tabStatus.partial': 'Partial',
      'profile.tabStatus.missing': 'Missing',
      'profile.tabErrorsAria': '{count} errors',
    };
    return (labels[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? ''));
  },
}));

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/features', () => ({
  PointsOverview: () => null,
  VerificationStatusCard: () => null,
}));

describe('Profile first fold', () => {
  it('shows two direct completion CTAs for a new profile', () => {
    const onSetActiveTab = vi.fn();

    render(
      <ProfileActionBar
        completeness={0}
        profile={{ userId: 'user-1' }}
        onOpenResumeExport={vi.fn()}
        onSetActiveTab={onSetActiveTab}
      />
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete GPA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete Test Scores' }));

    expect(onSetActiveTab).toHaveBeenNthCalledWith(1, 'gpa');
    expect(onSetActiveTab).toHaveBeenNthCalledWith(2, 'scores');
  });

  it('guides mid-progress users to the next missing signal and target review', () => {
    const onSetActiveTab = vi.fn();

    render(
      <ProfileActionBar
        completeness={45}
        profile={{
          userId: 'user-1',
          gpa: 3.8,
          testScores: [{ id: 'sat', type: 'SAT', score: 1540 }],
        }}
        onOpenResumeExport={vi.fn()}
        onSetActiveTab={onSetActiveTab}
      />
    );

    expect(screen.getByText('Next: Activities')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete Activities' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review target schools' }));

    expect(onSetActiveTab).toHaveBeenNthCalledWith(1, 'activities');
    expect(onSetActiveTab).toHaveBeenNthCalledWith(2, 'targets');
  });

  it('moves high-readiness actions to compact workflow links and export', () => {
    const onOpenResumeExport = vi.fn();

    render(
      <ProfileActionBar
        completeness={80}
        profile={{ userId: 'user-1', gpa: 3.8 }}
        onOpenResumeExport={onOpenResumeExport}
        onSetActiveTab={vi.fn()}
      />
    );

    expect(screen.getByRole('link', { name: 'Application Hub' })).toHaveAttribute(
      'href',
      '/uncommon-app'
    );
    expect(screen.getByRole('link', { name: 'Admission Prediction' })).toHaveAttribute(
      'href',
      '/prediction'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export Resume' }));
    expect(onOpenResumeExport).toHaveBeenCalledTimes(1);
  });

  it('renders tab completion dots without hiding validation errors', () => {
    render(
      <ProfileTabNav
        activeTab="basic"
        onTabChange={vi.fn()}
        tabCompletion={{ basic: 'complete', gpa: 'missing', recLetters: 'partial' }}
        tabErrors={{ scores: 2 }}
      />
    );

    expect(screen.getAllByLabelText('Complete').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('2 errors')).toBeInTheDocument();
  });
});
