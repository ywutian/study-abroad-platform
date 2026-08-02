import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProfileReadinessV1 } from '@study-abroad/shared';

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
      'profile.readiness.commandSummaryBlocked': '{count} blocker',
      'profile.readiness.commandSummaryAttention': '{count} warning',
      'profile.readiness.action.completeProfile': 'Complete Profile',
      'profile.readiness.action.addSchools': 'Add Schools',
      'profile.readiness.item.profile': 'Core Profile',
      'profile.readiness.item.schoolList': 'School Plan',
      'profile.readiness.item.prediction': 'Prediction',
      'profile.readiness.item.timeline': 'Execution',
      'profile.readiness.status.blocked': 'Blocked',
      'profile.readiness.status.attention': 'Needs attention',
      'profile.readiness.status.ready': 'Ready',
      'profile.actionBar.nextStep': 'Next: {signal}',
      'profile.actionBar.completeSignal': 'Complete {signal}',
      'profile.actionBar.readyForAnalysis': 'Ready for analysis',
      'profile.nextSteps.applicationHub': 'Application Workspace',
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
  VerificationStatusCard: () => null,
}));

describe('Profile first fold', () => {
  const readiness: ProfileReadinessV1 = {
    readinessVersion: 'profile-readiness-v1',
    computedAt: '2026-05-15T00:00:00.000Z',
    overall: {
      score: 52,
      status: 'attention',
      blockers: ['profile.gpa_anchor'],
      warnings: ['school_list.min_count'],
      canRunPrediction: false,
      canGenerateRecommendation: false,
      canRunApplicationAnalysis: false,
      nextActions: [
        {
          key: 'profile.gpa_anchor',
          href: '/profile?tab=gpa',
          targetTab: 'gpa',
          labelKey: 'profile.readiness.action.completeProfile',
          severity: 'critical',
        },
        {
          key: 'school_list.add_first',
          href: '/schools',
          labelKey: 'profile.readiness.action.addSchools',
          severity: 'critical',
        },
      ],
    },
    profileCompleteness: {
      score: 45,
      status: 'attention',
      gaps: ['profile.gpa_anchor'],
      testStrategy: 'unknown',
      counts: { testScores: 0, activities: 0, awards: 0 },
    },
    workflowReadiness: {
      score: 52,
      status: 'attention',
      items: [
        {
          key: 'profile',
          labelKey: 'profile.readiness.item.profile',
          score: 45,
          status: 'attention',
          gaps: ['profile.gpa_anchor'],
          href: '/profile',
        },
        {
          key: 'school_list',
          labelKey: 'profile.readiness.item.schoolList',
          score: 20,
          status: 'blocked',
          gaps: ['school_list.min_count'],
          href: '/profile?tab=targets',
          targetTab: 'targets',
        },
        {
          key: 'prediction',
          labelKey: 'profile.readiness.item.prediction',
          score: 0,
          status: 'blocked',
          gaps: ['prediction.fresh_authoritative_missing'],
          href: '/prediction',
        },
        {
          key: 'timeline',
          labelKey: 'profile.readiness.item.timeline',
          score: 0,
          status: 'blocked',
          gaps: ['timeline.missing_school_round'],
          href: '/timeline',
        },
      ],
    },
    schoolList: {
      count: 0,
      tierCounts: { reach: 0, target: 0, safety: 0 },
      missingRoundCount: 0,
      missingDeadlineCount: 0,
      balanced: false,
    },
    predictionDataSupport: {
      previewCount: 0,
      authoritativeCount: 0,
      freshAuthoritativeCount: 0,
      staleCount: 0,
      missingSchoolIds: [],
    },
    timeline: {
      coverageCount: 0,
      missingTimelineCount: 0,
      pendingTaskCount: 0,
      overdueTaskCount: 0,
      due7Count: 0,
      due30Count: 0,
    },
    essays: { count: 0, linkedPromptCount: 0 },
    resume: { count: 0, openIssueCount: 0, evidenceCount: 0 },
    recommendationLetters: {
      count: 0,
      requested: 0,
      inProgress: 0,
      submitted: 0,
      confirmed: 0,
      overdue: 0,
    },
    applicationAnalysis: {
      state: 'insufficientProfileData',
      targetSchoolCount: 0,
      schoolsWithPredictions: 0,
    },
    sources: {},
  };

  it('uses readiness as the command center CTA source', () => {
    const onSetActiveTab = vi.fn();

    render(
      <ProfileActionBar
        completeness={0}
        profile={{ userId: 'user-1' }}
        readiness={readiness}
        onOpenResumeExport={vi.fn()}
        onSetActiveTab={onSetActiveTab}
      />
    );

    expect(screen.getByText('52%')).toBeInTheDocument();
    expect(screen.getByText('1 blocker')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete Profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add Schools' })).toHaveAttribute('href', '/schools');
    expect(screen.getByRole('link', { name: /Core Profile/ })).toHaveAttribute('href', '/profile');

    fireEvent.click(screen.getByRole('button', { name: 'Complete Profile' }));
    fireEvent.click(screen.getByRole('button', { name: /School Plan/ }));

    expect(onSetActiveTab).toHaveBeenNthCalledWith(1, 'gpa');
    expect(onSetActiveTab).toHaveBeenNthCalledWith(2, 'targets');
  });

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

    expect(screen.getByRole('link', { name: 'Application Workspace' })).toHaveAttribute(
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
    expect(screen.getAllByLabelText('2 errors').length).toBeGreaterThan(0);
  });
});
