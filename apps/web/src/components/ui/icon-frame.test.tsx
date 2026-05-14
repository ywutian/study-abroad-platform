import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageCircle } from 'lucide-react';
import { IconFrame, InlineIcon } from './icon-frame';

describe('IconFrame', () => {
  it('renders decorative framed icons by default', () => {
    const { container } = render(<IconFrame icon={MessageCircle} tone="info" size="lg" />);

    const frame = container.querySelector('span');
    expect(frame).toHaveAttribute('aria-hidden', 'true');
    expect(frame).toHaveClass('h-12', 'w-12', 'rounded-xl');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('supports accessible icon labels', () => {
    render(<IconFrame icon={MessageCircle} aria-label="Assistant" />);

    expect(screen.getByRole('img', { name: 'Assistant' })).toBeInTheDocument();
  });

  it('renders inline icons with tone classes', () => {
    const { container } = render(<InlineIcon icon={MessageCircle} tone="success" size="sm" />);

    const icon = container.querySelector('svg');
    expect(icon).toHaveClass('h-3.5', 'w-3.5', 'text-emerald-600');
  });
});
