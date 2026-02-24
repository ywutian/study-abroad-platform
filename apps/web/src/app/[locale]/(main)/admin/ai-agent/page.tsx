'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout';
import { Bot } from 'lucide-react';
import { HealthSection } from './_components/health-section';
import { MetricsSection } from './_components/metrics-section';
import { FeaturesSection } from './_components/features-section';
import { LlmConfigSection } from './_components/llm-config-section';
import { QuotaSection } from './_components/quota-section';
import { AgentsSection } from './_components/agents-section';
import { CircuitBreakersSection } from './_components/circuit-breakers-section';
import { TracesSection } from './_components/traces-section';

export default function AdminAiAgentPage() {
  const t = useTranslations('admin.aiAgent');

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} icon={Bot} color="blue" />

      <div className="mt-6 space-y-6">
        <HealthSection />
        <MetricsSection />
        <FeaturesSection />
        <LlmConfigSection />
        <QuotaSection />
        <AgentsSection />
        <CircuitBreakersSection />
        <TracesSection />
      </div>
    </>
  );
}
