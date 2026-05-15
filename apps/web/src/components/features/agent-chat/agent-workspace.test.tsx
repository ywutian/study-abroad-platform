import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AgentType } from '@study-abroad/shared';
import { AgentWorkspace } from './agent-workspace';

const agentChatMock = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));

const historyMock = vi.hoisted(() => ({
  conversations: [
    {
      id: 'conv-1',
      title: 'MIT shortlist follow-up',
      summary: 'Review school list balance',
      agentType: 'school',
      messageCount: 4,
      createdAt: '2026-05-01T12:00:00.000Z',
      updatedAt: '2026-05-15T12:00:00.000Z',
    },
  ],
  deleteConversation: vi.fn(),
}));

const statusMock = vi.hoisted(() => ({
  refreshContext: vi.fn(),
}));

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('./agent-chat', () => ({
  AgentChat: (props: Record<string, unknown>) => {
    agentChatMock.props.push(props);
    const pendingAction = props.pendingAction as { message?: string } | null | undefined;
    return <div data-testid="agent-chat">{String(pendingAction?.message ?? '')}</div>;
  },
}));

vi.mock('./use-chat-history', () => ({
  useConversationList: () => ({ data: historyMock.conversations, isLoading: false }),
  useDeleteConversation: () => ({ mutateAsync: historyMock.deleteConversation }),
}));

vi.mock('./use-agent-status', () => ({
  useAgentStatus: () => ({
    health: { data: { status: 'healthy', llm: { isHealthy: true, model: 'gpt-test' } } },
    usage: {
      data: {
        today: { tokens: 2500, calls: 3, cost: 0.12 },
        quota: { dailyTokens: 10000, monthlyTokens: 100000 },
        remaining: { dailyTokens: 7500, monthlyTokens: 97500 },
      },
    },
    rateLimit: { data: { conversation: { remaining: 18, limit: 20 } } },
    refreshContext: { mutateAsync: statusMock.refreshContext, isPending: false },
  }),
}));

const messages = {
  agentChat: {
    assistant: 'AI Assistant',
    newConversation: 'New Chat',
    searchConversations: 'Search conversations...',
    noSearchResults: 'No matching conversations found',
    noConversationsDesc: 'Start a new conversation to get help',
    deleteConversation: 'Delete Conversation',
    deleteConfirm: 'Are you sure you want to delete this conversation?',
    cancel: 'Cancel',
    delete: 'Delete',
    workspace: {
      kicker: 'AI Command Desk',
      title: 'Study Abroad AI Workspace',
      description: 'Workspace description',
      boundary: 'Analysis center boundary',
      openAnalysisCenter: 'Open analysis center',
      conversations: { title: 'Conversation Queue' },
      tasks: {
        title: 'Task Entrypoints',
        desc: 'Task description',
      },
      actions: {
        askAI: 'Ask AI',
        openTool: 'Open Tool',
        analysisFollowup: {
          title: 'Interpret Existing Analysis',
          desc: 'Ask follow-ups about existing analysis.',
          message: 'Interpret my existing analysis without regenerating it.',
        },
        schoolShortlist: {
          title: 'School List Follow-up',
          desc: 'Review target schools.',
          message: 'Review my current school list strategy.',
        },
        essayReview: {
          title: 'Essay Strategy',
          desc: 'Turn essay strategy into edits.',
          message: 'Help me plan an essay revision strategy.',
        },
        deadlinePlan: {
          title: 'Deadline Planning',
          desc: 'Convert dates into a timeline.',
          message: 'Help me organize application deadlines.',
        },
        resumeReview: {
          title: 'Resume Optimization',
          desc: 'Review resume direction.',
          message: 'Review my resume optimization direction.',
        },
      },
      status: {
        title: 'Runtime Status',
        ready: 'Ready',
        degraded: 'Degraded',
        model: 'Model',
        rateLimit: 'Request Window',
        dailyTokens: 'Daily Tokens Left',
        conversationWindow: 'Conversation Window',
        unknown: 'N/A',
        boundary: 'Status boundary',
        refreshContext: 'Refresh Context',
        contextRefreshSuccess: 'Context refreshed',
        contextRefreshError: 'Could not refresh context.',
      },
    },
  },
};

function renderWorkspace() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AgentWorkspace />
    </NextIntlClientProvider>
  );
}

describe('AgentWorkspace', () => {
  beforeEach(() => {
    agentChatMock.props = [];
    historyMock.deleteConversation.mockReset();
    statusMock.refreshContext.mockReset();
  });

  it('renders the enterprise workspace shell without duplicating analysis content', () => {
    renderWorkspace();

    expect(screen.getByText('Study Abroad AI Workspace')).toBeInTheDocument();
    expect(screen.getByText('Conversation Queue')).toBeInTheDocument();
    expect(screen.getByText('MIT shortlist follow-up')).toBeInTheDocument();
    expect(screen.getByText('Task Entrypoints')).toBeInTheDocument();
    expect(screen.getByText('Interpret Existing Analysis')).toBeInTheDocument();
    expect(screen.getByText('Runtime Status')).toBeInTheDocument();
    expect(screen.getByText('gpt-test')).toBeInTheDocument();
    expect(screen.getByTestId('agent-chat')).toBeInTheDocument();
  });

  it('routes task actions into AgentChat with the matching agent hint', () => {
    renderWorkspace();

    fireEvent.click(screen.getAllByRole('button', { name: 'Ask AI' })[0]);

    expect(
      screen.getByText('Interpret my existing analysis without regenerating it.')
    ).toBeInTheDocument();
    const latestProps = agentChatMock.props.at(-1);
    expect(latestProps?.pendingAction).toMatchObject({
      message: 'Interpret my existing analysis without regenerating it.',
      agentHint: AgentType.PROFILE,
    });
  });
});
