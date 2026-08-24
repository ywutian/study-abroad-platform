'use client';

import { CircuitBreakersSection } from '../../ai-agent/_components/circuit-breakers-section';
import { TracesSection } from '../../ai-agent/_components/traces-section';
import { HarnessSkillsSection } from './harness-skills-section';

export function ReliabilityTab() {
  return (
    <div className="space-y-6">
      <HarnessSkillsSection />
      <CircuitBreakersSection />
      <TracesSection />
    </div>
  );
}
