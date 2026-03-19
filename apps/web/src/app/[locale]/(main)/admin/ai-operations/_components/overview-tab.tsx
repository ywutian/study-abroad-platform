'use client';

import { HealthSection } from '../../ai-agent/_components/health-section';
import { SystemHealthPanel } from './system-health-panel';

export function OverviewTab() {
  return (
    <div className="space-y-6">
      <HealthSection />
      <SystemHealthPanel />
    </div>
  );
}
