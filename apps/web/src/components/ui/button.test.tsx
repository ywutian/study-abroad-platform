import { render, screen } from '@testing-library/react';
/* eslint-disable @next/next/no-html-link-for-pages -- The test verifies Radix Slot behavior with a native anchor child. */
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-variant', 'default');
    expect(button).toHaveAttribute('data-size', 'default');
  });

  it('renders with custom variant and size', () => {
    render(
      <Button variant="destructive" size="lg">
        Delete
      </Button>
    );
    const button = screen.getByRole('button', { name: /delete/i });
    expect(button).toHaveAttribute('data-variant', 'destructive');
    expect(button).toHaveAttribute('data-size', 'lg');
  });

  it('handles click events', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  it('is disabled when disabled prop is passed', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders all variant types without error', () => {
    const variants = [
      'default',
      'destructive',
      'outline',
      'secondary',
      'ghost',
      'link',
      'gradient',
      'soft',
    ] as const;

    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all size types without error', () => {
    const sizes = ['default', 'sm', 'lg', 'xl', 'icon'] as const;

    for (const size of sizes) {
      const { unmount } = render(<Button size={size}>btn</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('data-size', size);
      unmount();
    }
  });
});
