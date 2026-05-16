import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardQuickAsk } from './dashboard-quick-ask';

// Spy on the bridge — Quick Ask's whole purpose is to push the typed
// message into the global FloatingChat queue.
const openFloatingAgentChat = vi.fn();

vi.mock('@/components/features/agent-chat/floating-chat-bridge', () => ({
  openFloatingAgentChat: (...args: unknown[]) => openFloatingAgentChat(...args),
}));

const messages = {
  dashboard: {
    quickAsk: {
      placeholder: 'Ask Lumni anything...',
      submit: 'Ask',
      try: 'Try',
      suggestions: {
        predict: 'What are my chances at MIT?',
        essays: 'Help me brainstorm a Common App essay',
        schools: 'Suggest 5 reach schools for CS',
      },
      openFullWorkspace: 'Open full AI workspace',
      openFullWorkspaceHint: 'Need a longer conversation? Open the AI workspace.',
    },
  },
};

function renderQuickAsk() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DashboardQuickAsk />
    </NextIntlClientProvider>
  );
}

describe('DashboardQuickAsk', () => {
  beforeEach(() => {
    openFloatingAgentChat.mockClear();
  });

  it('renders the input, submit button, and three suggestion chips', () => {
    renderQuickAsk();
    expect(screen.getByPlaceholderText('Ask Lumni anything...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ask/i })).toBeInTheDocument();
    expect(screen.getByText('What are my chances at MIT?')).toBeInTheDocument();
    expect(screen.getByText('Help me brainstorm a Common App essay')).toBeInTheDocument();
    expect(screen.getByText('Suggest 5 reach schools for CS')).toBeInTheDocument();
  });

  it('disables the submit button when the input is empty', () => {
    renderQuickAsk();
    const submit = screen.getByRole('button', { name: /Ask/i });
    expect(submit).toBeDisabled();
  });

  it('enables submit and dispatches openFloatingAgentChat on form submit', () => {
    renderQuickAsk();
    const input = screen.getByPlaceholderText('Ask Lumni anything...');
    const submit = screen.getByRole('button', { name: /Ask/i });

    fireEvent.change(input, { target: { value: 'How strong is my GPA?' } });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);

    expect(openFloatingAgentChat).toHaveBeenCalledTimes(1);
    expect(openFloatingAgentChat).toHaveBeenCalledWith({
      message: 'How strong is my GPA?',
    });
  });

  it('trims whitespace before dispatching and ignores all-whitespace input', () => {
    renderQuickAsk();
    const input = screen.getByPlaceholderText('Ask Lumni anything...') as HTMLInputElement;

    // All whitespace should not enable the submit (trim().length === 0 path).
    fireEvent.change(input, { target: { value: '     ' } });
    const submit = screen.getByRole('button', { name: /Ask/i });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(openFloatingAgentChat).not.toHaveBeenCalled();

    // Trims surrounding whitespace.
    fireEvent.change(input, { target: { value: '  Real question  ' } });
    fireEvent.click(submit);
    expect(openFloatingAgentChat).toHaveBeenCalledWith({ message: 'Real question' });
  });

  it('clears the input after a successful submit', () => {
    renderQuickAsk();
    const input = screen.getByPlaceholderText('Ask Lumni anything...') as HTMLInputElement;
    const submit = screen.getByRole('button', { name: /Ask/i });

    fireEvent.change(input, { target: { value: 'Will I get into Harvard?' } });
    fireEvent.click(submit);

    expect(input.value).toBe('');
  });

  it('dispatches the suggestion text directly when a suggestion chip is clicked', () => {
    renderQuickAsk();
    fireEvent.click(screen.getByText('What are my chances at MIT?'));

    expect(openFloatingAgentChat).toHaveBeenCalledTimes(1);
    expect(openFloatingAgentChat).toHaveBeenCalledWith({
      message: 'What are my chances at MIT?',
    });
  });

  // 2026-05 Phase 2.5d: the "open full AI workspace" link disambiguates
  // QuickAsk (quick inline asks → FloatingChat panel) from /ai (full
  // multi-turn workspace with tool calls + history). Without this link
  // users didn't know the full workspace existed.
  it('renders an "Open full AI workspace" link pointing to /ai', () => {
    renderQuickAsk();
    const link = screen.getByRole('link', { name: /open full ai workspace/i });
    expect(link).toBeInTheDocument();
    // Next.js Link prefixes the locale; assert the path tail.
    expect(link.getAttribute('href')).toMatch(/\/ai$/);
  });
});
