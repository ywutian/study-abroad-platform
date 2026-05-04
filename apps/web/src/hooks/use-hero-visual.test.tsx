import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_HERO_VISUAL_ID, HERO_VISUAL_STORAGE_KEY } from '@study-abroad/shared';
import { HeroVisualManager, useHeroVisual } from './use-hero-visual';

function HeroVisualHarness() {
  const { heroVisual, setHeroVisual } = useHeroVisual();

  return (
    <div>
      <div data-testid="hero-visual">{heroVisual}</div>
      <button type="button" onClick={() => setHeroVisual('framer-orbit')}>
        Set Framer
      </button>
    </div>
  );
}

describe('useHeroVisual', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-hero-visual');
  });

  afterEach(() => {
    cleanup();
  });

  it('applies the stored hero visual to the document root', async () => {
    localStorage.setItem(HERO_VISUAL_STORAGE_KEY, 'command-center');

    render(
      <>
        <HeroVisualManager />
        <HeroVisualHarness />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('hero-visual')).toHaveTextContent('command-center');
    });
    expect(document.documentElement).toHaveAttribute('data-hero-visual', 'command-center');
  });

  it('updates localStorage and the document root when changed', async () => {
    render(<HeroVisualHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Set Framer' }));

    await waitFor(() => {
      expect(screen.getByTestId('hero-visual')).toHaveTextContent('framer-orbit');
    });
    expect(localStorage.getItem(HERO_VISUAL_STORAGE_KEY)).toBe('framer-orbit');
    expect(document.documentElement).toHaveAttribute('data-hero-visual', 'framer-orbit');
  });

  it('falls back to the default for invalid and legacy stored values', async () => {
    localStorage.setItem(HERO_VISUAL_STORAGE_KEY, 'matrix-premium');

    render(
      <>
        <HeroVisualManager />
        <HeroVisualHarness />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('hero-visual')).toHaveTextContent(DEFAULT_HERO_VISUAL_ID);
    });
    expect(document.documentElement).toHaveAttribute('data-hero-visual', DEFAULT_HERO_VISUAL_ID);
    expect(localStorage.getItem(HERO_VISUAL_STORAGE_KEY)).toBe(DEFAULT_HERO_VISUAL_ID);
  });
});
