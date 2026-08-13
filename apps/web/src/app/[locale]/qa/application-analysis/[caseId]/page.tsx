import { notFound } from 'next/navigation';
import { getApplicationAnalysisRenderFixture } from '@study-abroad/shared';

import { ProfileAIAnalysis } from '@/components/features';

interface PageProps {
  params: Promise<{
    locale: string;
    caseId: string;
  }>;
}

export default async function ApplicationAnalysisQAPage({ params }: PageProps) {
  if (process.env.ENABLE_E2E_FIXTURES !== 'true') {
    notFound();
  }

  const resolvedParams = await params;
  const fixture = getApplicationAnalysisRenderFixture(resolvedParams.caseId);

  if (!fixture || fixture.locale !== resolvedParams.locale) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">QA Fixture</p>
        <h1 className="text-title font-semibold text-foreground">
          Application Analysis Render Parity
        </h1>
        <p className="text-sm text-muted-foreground">{fixture.caseId}</p>
      </div>
      <ProfileAIAnalysis analysis={fixture.analysis} />
    </div>
  );
}
