'use client';

import { MetricsSection } from '../../ai-agent/_components/metrics-section';
import { TokenUsageTab } from '../../analytics/_components/token-usage-tab';
import { AgentPerformanceTab } from '../../analytics/_components/agent-performance-tab';

export function PerformanceTab() {
  return (
    <div className="space-y-6">
      <MetricsSection />
      <TokenUsageTab />
      <AgentPerformanceTab />
    </div>
  );
}
