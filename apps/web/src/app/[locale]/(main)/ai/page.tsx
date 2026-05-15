'use client';

import { PageContainer } from '@/components/layout';
import { AgentWorkspace } from '@/components/features/agent-chat/agent-workspace';

export default function AIPage() {
  return (
    <PageContainer
      variant="ai"
      maxWidth="fluid"
      className="flex min-h-[calc(100dvh-8rem)] flex-col"
    >
      <AgentWorkspace />
    </PageContainer>
  );
}
