'use client';

import { FeaturesSection } from '../../ai-agent/_components/features-section';
import { LlmConfigSection } from '../../ai-agent/_components/llm-config-section';
import { QuotaSection } from '../../ai-agent/_components/quota-section';
import { AgentsSection } from '../../ai-agent/_components/agents-section';

export function ConfigurationTab() {
  return (
    <div className="space-y-6">
      <FeaturesSection />
      <LlmConfigSection />
      <QuotaSection />
      <AgentsSection />
    </div>
  );
}
