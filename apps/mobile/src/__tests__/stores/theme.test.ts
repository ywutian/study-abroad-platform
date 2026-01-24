/**
 * Tests for the theme store (src/stores/theme.ts).
 *
 * The theme store imports { Appearance } from 'react-native' and
 * { storage } from '@/lib/storage/secure-store'.
 *
 * We mock both so the tests are fully isolated from native modules.
 */

import { act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/lib/storage/secure-store', () => ({
  getAccessToken: jest.fn(),
  saveTokens: jest.fn(),
  clearAuthData: jest.fn(),
  saveUser: jest.fn(),
  getUser: jest.fn(),
  getRefreshToken: jest.fn(),
  storage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native', () => ({
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
    addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: { OS: 'ios', select: jest.fn((obj: Record<string, unknown>) => obj.ios) },
}));

// Override the global mock from jest.setup.js so we get the real zustand store
jest.unmock('@/stores/theme');

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { Appearance } from 'react-native';
import { useThemeStore } from '@/stores/theme';
import { storage } from '@/lib/storage/secure-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THEME_KEY = 'app_theme';

/**
 * Grab the Appearance.addChangeListener callback that the theme store
 * registered at module load time.  We capture this once since the store
 * module only runs once and jest.clearAllMocks() would wipe the mock.calls.
 */
let appearanceListenerCallback: (prefs: { colorScheme: string | null }) => void;

function resetStore() {
  useThemeStore.setState({
    mode: 'system',
    colorScheme: 'light',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Theme Store', () => {
  // Capture the listener callback ONCE before any test clears mocks.
  beforeAll(() => {
    const calls = (Appearance.addChangeListener as jest.Mock).mock.calls;
    // The store module registers the listener at import time.
    expect(calls.length).toBeGreaterThanOrEqual(1);
    appearanceListenerCallback = calls[0][0];
  });

  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
    // Restore default getColorScheme behaviour after clearAllMocks
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');
    // Restore default storage.get behaviour (returns null = empty)
    (storage.get as jest.Mock).mockResolvedValue(null);
    (storage.set as jest.Mock).mockResolvedValue(undefined);
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it('has correct initial state defaults', () => {
    const state = useThemeStore.getState();

    expect(state.mode).toBe('system');
    expect(state.colorScheme).toBe('light');
  });

  // -----------------------------------------------------------------------
  // setMode
  // -----------------------------------------------------------------------

  it('setMode("dark") persists to storage and updates state', async () => {
    await act(async () => {
      await useThemeStore.getState().setMode('dark');
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('dark');
    expect(state.colorScheme).toBe('dark');
    expect(storage.set).toHaveBeenCalledWith(THEME_KEY, 'dark');
  });

  it('setMode("light") persists to storage and updates state', async () => {
    await act(async () => {
      await useThemeStore.getState().setMode('light');
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('light');
    expect(state.colorScheme).toBe('light');
    expect(storage.set).toHaveBeenCalledWith(THEME_KEY, 'light');
  });

  it('setMode("system") resolves colorScheme from Appearance', async () => {
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');

    await act(async () => {
      await useThemeStore.getState().setMode('system');
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
    expect(state.colorScheme).toBe('dark');
  });

  it('setMode calls storage.set with the mode value', async () => {
    await act(async () => {
      await useThemeStore.getState().setMode('light');
    });

    expect(storage.set).toHaveBeenCalledWith(THEME_KEY, 'light');
  });

  // -----------------------------------------------------------------------
  // loadTheme
  // -----------------------------------------------------------------------

  it('loadTheme restores saved mode from storage', async () => {
    (storage.get as jest.Mock).mockResolvedValue('dark');

    await act(async () => {
      await useThemeStore.getState().loadTheme();
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('dark');
    expect(state.colorScheme).toBe('dark');
  });

  it('loadTheme falls back to "system" when storage is empty', async () => {
    (storage.get as jest.Mock).mockResolvedValue(null);
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');

    await act(async () => {
      await useThemeStore.getState().loadTheme();
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
    expect(state.colorScheme).toBe('dark');
  });

  it('loadTheme resolves system colorScheme via Appearance when mode is "system"', async () => {
    (storage.get as jest.Mock).mockResolvedValue('system');
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');

    await act(async () => {
      await useThemeStore.getState().loadTheme();
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
    expect(state.colorScheme).toBe('dark');
  });

  it('loadTheme sets mode to "light" when "light" is saved', async () => {
    (storage.get as jest.Mock).mockResolvedValue('light');

    await act(async () => {
      await useThemeStore.getState().loadTheme();
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('light');
    expect(state.colorScheme).toBe('light');
  });

  // -----------------------------------------------------------------------
  // Appearance change listener
  // -----------------------------------------------------------------------

  it('registers an Appearance change listener on module load', () => {
    // Verified in beforeAll; re-assert for documentation purposes
    expect(appearanceListenerCallback).toBeDefined();
    expect(typeof appearanceListenerCallback).toBe('function');
  });

  it('Appearance listener updates colorScheme when mode is "system"', () => {
    useThemeStore.setState({ mode: 'system', colorScheme: 'light' });

    act(() => {
      appearanceListenerCallback({ colorScheme: 'dark' });
    });

    expect(useThemeStore.getState().colorScheme).toBe('dark');
  });

  it('Appearance listener does NOT update colorScheme when mode is "light"', () => {
    useThemeStore.setState({ mode: 'light', colorScheme: 'light' });

    act(() => {
      appearanceListenerCallback({ colorScheme: 'dark' });
    });

    expect(useThemeStore.getState().colorScheme).toBe('light');
  });

  it('Appearance listener does NOT update colorScheme when mode is "dark"', () => {
    useThemeStore.setState({ mode: 'dark', colorScheme: 'dark' });

    act(() => {
      appearanceListenerCallback({ colorScheme: 'light' });
    });

    expect(useThemeStore.getState().colorScheme).toBe('dark');
  });
});
