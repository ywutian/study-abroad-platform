import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExperimentCard } from './experiment-card';

const experiment = {
  id: 'experiment-1',
  capability: 'RECOURSE' as const,
  version: 'v1',
  status: 'DRAFT' as const,
  methodVersion: 'method-v1',
  createdAt: '2026-08-11T00:00:00.000Z',
  updatedAt: '2026-08-11T00:00:00.000Z',
};

const labels = {
  promoteShadow: 'Promote to shadow',
  refreshEvaluation: 'Refresh evaluation',
  promoteCanary: 'Promote to canary',
  activate: 'Activate',
  retire: 'Retire',
};

function renderCard() {
  const handlers = {
    onSelect: vi.fn(),
    onShadow: vi.fn(),
    onEvaluate: vi.fn(),
    onCanary: vi.fn(),
    onActivate: vi.fn(),
    onRetire: vi.fn(),
  };
  render(<ExperimentCard experiment={experiment} selected={false} labels={labels} {...handlers} />);
  return handlers;
}

describe('ExperimentCard', () => {
  it.each(['Enter', ' '])('selects with the %s key', (key) => {
    const handlers = renderCard();
    fireEvent.keyDown(screen.getByRole('button', { name: /recourse/i }), { key });
    expect(handlers.onSelect).toHaveBeenCalledOnce();
  });

  it('runs an action without also selecting the card', () => {
    const handlers = renderCard();
    fireEvent.click(screen.getByRole('button', { name: labels.promoteShadow }));
    expect(handlers.onShadow).toHaveBeenCalledOnce();
    expect(handlers.onSelect).not.toHaveBeenCalled();
  });
});
