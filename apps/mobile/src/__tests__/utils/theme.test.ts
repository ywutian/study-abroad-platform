/**
 * Tests for the theme utilities at src/utils/theme.ts
 *
 * Covers: color values for light/dark themes, useColors() hook,
 * spacing, fontSize, fontWeight, borderRadius constants,
 * getColors(), createStyles(), and type-level expectations.
 */

import { renderHook } from '@testing-library/react-native';

// The global jest.setup.js has a default mock for @/stores/theme.
// We override it here so we can control colorScheme per test.
// Mock useThemeStore as a Zustand-style hook that accepts a selector
const mockState = { colorScheme: 'light' as string | null, colorPalette: 'lumni-warm' };
jest.mock('@/stores/theme', () => ({
  useThemeStore: jest.fn((selector?: (s: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState
  ),
}));

import { useThemeStore } from '@/stores/theme';

import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  lineHeight,
  animation,
  shadows,
  useColors,
  getColors,
  getPaletteColors,
  createStyles,
} from '@/utils/theme';

// ======================================================================
// Color system
// ======================================================================
describe('colors', () => {
  describe('light theme', () => {
    it('has the correct primary color', () => {
      expect(colors.light.primary).toBe('#1d1813');
    });

    it('has the correct background color', () => {
      expect(colors.light.background).toBe('#f7f1e6');
    });

    it('has the correct foreground color', () => {
      expect(colors.light.foreground).toBe('#1d1813');
    });

    it('has the correct card color', () => {
      expect(colors.light.card).toBe('#fff9ef');
    });

    it('has the correct border color', () => {
      expect(colors.light.border).toBe('#d8c8b2');
    });

    it('has the correct success color', () => {
      expect(colors.light.success).toBe('#6f7b58');
    });

    it('has the correct error color', () => {
      expect(colors.light.error).toBe('#b85c58');
    });

    it('has the correct warning color', () => {
      expect(colors.light.warning).toBe('#b7832f');
    });

    it('has the correct info color', () => {
      expect(colors.light.info).toBe('#6574ff');
    });

    it('has the correct overlay value', () => {
      expect(colors.light.overlay).toBe('rgba(29, 24, 19, 0.52)');
    });
  });

  describe('dark theme', () => {
    it('has the correct primary color', () => {
      expect(colors.dark.primary).toBe('#ddb85a');
    });

    it('has the correct background color', () => {
      expect(colors.dark.background).toBe('#0f0d0a');
    });

    it('has the correct foreground color', () => {
      expect(colors.dark.foreground).toBe('#f6edde');
    });

    it('has the correct card color', () => {
      expect(colors.dark.card).toBe('#191510');
    });

    it('has the correct border color', () => {
      expect(colors.dark.border).toBe('#3b3026');
    });

    it('has the correct success color', () => {
      expect(colors.dark.success).toBe('#a3a06f');
    });

    it('has the correct error color', () => {
      expect(colors.dark.error).toBe('#e98a7f');
    });

    it('has the correct warning color', () => {
      expect(colors.dark.warning).toBe('#ddb85a');
    });

    it('has the correct info color', () => {
      expect(colors.dark.info).toBe('#8d96ff');
    });

    it('has the correct overlay value', () => {
      expect(colors.dark.overlay).toBe('rgba(0, 0, 0, 0.68)');
    });
  });

  it('light and dark themes have the same set of keys', () => {
    const lightKeys = Object.keys(colors.light).sort();
    const darkKeys = Object.keys(colors.dark).sort();
    expect(lightKeys).toEqual(darkKeys);
  });
});

// ======================================================================
// useColors hook
// ======================================================================
describe('useColors', () => {
  afterEach(() => {
    mockState.colorScheme = 'light';
    mockState.colorPalette = 'lumni-warm';
    jest.restoreAllMocks();
  });

  it('returns light colors when colorScheme is light', () => {
    mockState.colorScheme = 'light';
    mockState.colorPalette = 'lumni-warm';

    const { result } = renderHook(() => useColors());

    expect(result.current.primary).toBe(colors.light.primary);
    expect(result.current.background).toBe(colors.light.background);
    expect(result.current.foreground).toBe(colors.light.foreground);
  });

  it('returns dark colors when colorScheme is dark', () => {
    mockState.colorScheme = 'dark';

    const { result } = renderHook(() => useColors());

    expect(result.current.primary).toBe(colors.dark.primary);
    expect(result.current.background).toBe(colors.dark.background);
    expect(result.current.foreground).toBe(colors.dark.foreground);
  });

  it('falls back to light colors when colorScheme is null (system)', () => {
    mockState.colorScheme = null;

    const { result } = renderHook(() => useColors());

    // null is not 'dark', so the ternary yields colors.light
    expect(result.current.primary).toBe(colors.light.primary);
  });

  it('returns the selected color palette colors', () => {
    mockState.colorScheme = 'light';
    mockState.colorPalette = 'studio-black-blue';

    const { result } = renderHook(() => useColors());

    expect(result.current.primary).toBe(getPaletteColors('studio-black-blue', 'light').primary);
    expect(result.current.primary).not.toBe(colors.light.primary);
  });

  it('returns default palette colors when colorPalette is default', () => {
    (useThemeStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ colorScheme: 'light', colorPalette: 'default' })
    );

    const { result } = renderHook(() => useColors());

    expect(result.current.primary).toBe(colors.light.primary);
    expect(result.current.background).toBe(colors.light.background);
  });
});

// ======================================================================
// getColors (non-hook helper)
// ======================================================================
describe('getColors', () => {
  it('returns dark colors when isDark is true', () => {
    const c = getColors(true);
    expect(c.primary).toBe(colors.dark.primary);
    expect(c.background).toBe(colors.dark.background);
  });

  it('returns light colors when isDark is false', () => {
    const c = getColors(false);
    expect(c.primary).toBe(colors.light.primary);
  });

  it('returns light colors when isDark is undefined', () => {
    const c = getColors();
    expect(c.primary).toBe(colors.light.primary);
  });

  it('returns alternate palette colors when a palette is provided', () => {
    const c = getColors(false, 'framer-violet');
    expect(c.primary).toBe(getPaletteColors('framer-violet', 'light').primary);
    expect(c.primary).not.toBe(colors.light.primary);
  });
});

// ======================================================================
// createStyles
// ======================================================================
describe('createStyles', () => {
  it('returns a function that produces styles for light theme', () => {
    const useStyles = createStyles((theme) => ({
      container: { backgroundColor: theme.background },
    }));

    const styles = useStyles(false);
    expect(styles.container.backgroundColor).toBe(colors.light.background);
  });

  it('returns a function that produces styles for dark theme', () => {
    const useStyles = createStyles((theme) => ({
      container: { backgroundColor: theme.background },
    }));

    const styles = useStyles(true);
    expect(styles.container.backgroundColor).toBe(colors.dark.background);
  });
});

// ======================================================================
// Spacing
// ======================================================================
describe('spacing', () => {
  it('has correct xs value', () => {
    expect(spacing.xs).toBe(4);
  });

  it('has correct sm value', () => {
    expect(spacing.sm).toBe(8);
  });

  it('has correct md value', () => {
    expect(spacing.md).toBe(12);
  });

  it('has correct lg value', () => {
    expect(spacing.lg).toBe(16);
  });

  it('has correct xl value', () => {
    expect(spacing.xl).toBe(20);
  });

  it('has correct 2xl value', () => {
    expect(spacing['2xl']).toBe(24);
  });

  it('has correct 3xl value', () => {
    expect(spacing['3xl']).toBe(32);
  });

  it('has correct 4xl value', () => {
    expect(spacing['4xl']).toBe(40);
  });

  it('has correct 5xl value', () => {
    expect(spacing['5xl']).toBe(48);
  });

  it('values are all numeric and increase monotonically', () => {
    const vals = Object.values(spacing);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });
});

// ======================================================================
// Font size
// ======================================================================
describe('fontSize', () => {
  it('has correct xs value', () => {
    expect(fontSize.xs).toBe(12);
  });

  it('has correct sm value', () => {
    expect(fontSize.sm).toBe(14);
  });

  it('has correct base value', () => {
    expect(fontSize.base).toBe(16);
  });

  it('has correct lg value', () => {
    expect(fontSize.lg).toBe(18);
  });

  it('has correct xl value', () => {
    expect(fontSize.xl).toBe(20);
  });

  it('has correct 2xl value', () => {
    expect(fontSize['2xl']).toBe(24);
  });

  it('has correct 3xl value', () => {
    expect(fontSize['3xl']).toBe(30);
  });

  it('has correct 4xl value', () => {
    expect(fontSize['4xl']).toBe(36);
  });

  it('values are all numeric and increase monotonically', () => {
    const vals = Object.values(fontSize);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });
});

// ======================================================================
// Font weight
// ======================================================================
describe('fontWeight', () => {
  it('has correct normal value', () => {
    expect(fontWeight.normal).toBe('400');
  });

  it('has correct medium value', () => {
    expect(fontWeight.medium).toBe('500');
  });

  it('has correct semibold value', () => {
    expect(fontWeight.semibold).toBe('600');
  });

  it('has correct bold value', () => {
    expect(fontWeight.bold).toBe('700');
  });

  it('all values are string-typed numeric weights', () => {
    Object.values(fontWeight).forEach((w) => {
      expect(typeof w).toBe('string');
      expect(Number(w)).toBeGreaterThanOrEqual(100);
      expect(Number(w)).toBeLessThanOrEqual(900);
    });
  });
});

// ======================================================================
// Border radius
// ======================================================================
describe('borderRadius', () => {
  it('has correct none value', () => {
    expect(borderRadius.none).toBe(0);
  });

  it('has correct sm value', () => {
    expect(borderRadius.sm).toBe(8);
  });

  it('has correct md value', () => {
    expect(borderRadius.md).toBe(12);
  });

  it('has correct lg value', () => {
    expect(borderRadius.lg).toBe(16);
  });

  it('has correct xl value', () => {
    expect(borderRadius.xl).toBe(20);
  });

  it('has correct 2xl value', () => {
    expect(borderRadius['2xl']).toBe(24);
  });

  it('has correct full value', () => {
    expect(borderRadius.full).toBe(9999);
  });
});

// ======================================================================
// Line height
// ======================================================================
describe('lineHeight', () => {
  it('has correct tight value', () => {
    expect(lineHeight.tight).toBe(1.25);
  });

  it('has correct normal value', () => {
    expect(lineHeight.normal).toBe(1.5);
  });

  it('has correct relaxed value', () => {
    expect(lineHeight.relaxed).toBe(1.625);
  });
});

// ======================================================================
// Animation
// ======================================================================
describe('animation', () => {
  it('has duration presets', () => {
    expect(animation.duration.instant).toBe(100);
    expect(animation.duration.fast).toBe(150);
    expect(animation.duration.normal).toBe(200);
    expect(animation.duration.slow).toBe(300);
    expect(animation.duration.slower).toBe(500);
  });

  it('has spring configurations', () => {
    expect(animation.spring.gentle).toEqual({ damping: 15, stiffness: 150 });
    expect(animation.spring.snappy).toEqual({ damping: 20, stiffness: 300 });
    expect(animation.spring.bouncy).toEqual({ damping: 10, stiffness: 200 });
  });

  it('has stagger delays', () => {
    expect(animation.stagger.fast).toBe(30);
    expect(animation.stagger.normal).toBe(50);
    expect(animation.stagger.slow).toBe(80);
  });
});

// ======================================================================
// Shadows
// ======================================================================
describe('shadows', () => {
  it('has sm shadow preset', () => {
    expect(shadows.sm.elevation).toBe(1);
    expect(shadows.sm.shadowRadius).toBe(2);
  });

  it('has md shadow preset', () => {
    expect(shadows.md.elevation).toBe(2);
  });

  it('has lg shadow preset', () => {
    expect(shadows.lg.elevation).toBe(2);
  });

  it('has xl shadow preset', () => {
    expect(shadows.xl.elevation).toBe(2);
  });

  it('elevations are non-decreasing from sm to xl', () => {
    expect(shadows.sm.elevation).toBeLessThanOrEqual(shadows.md.elevation);
    expect(shadows.md.elevation).toBeLessThanOrEqual(shadows.lg.elevation);
    expect(shadows.lg.elevation).toBeLessThanOrEqual(shadows.xl.elevation);
  });
});
