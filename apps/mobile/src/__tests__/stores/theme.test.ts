import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock AsyncStorage (used by the storage helper)
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

// Mock expo-secure-store (imported transitively by secure-store)
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock Appearance so we control getColorScheme() and addChangeListener
const mockAddChangeListener = jest.fn(() => ({ remove: jest.fn() }));
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Appearance: {
      getColorScheme: jest.fn(() => 'light'),
      addChangeListener: mockAddChangeListener,
    },
    Platform: { OS: 'ios' },
  };
});

import { Appearance } from 'react-native';
import { useThemeStore } from '@/stores/theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THEME_KEY = 'app_theme';

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
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it('has correct initial state defaults', () => {
    const state = useThemeStore.getState();

    expect(state.mode).toBe('system');
    // colorScheme should be whatever Appearance.getColorScheme returns
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
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_KEY, 'dark');
  });

  it('setMode("light") persists to storage and updates state', async () => {
    await act(async () => {
      await useThemeStore.getState().setMode('light');
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('light');
    expect(state.colorScheme).toBe('light');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_KEY, 'light');
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

  it('setMode calls storage.set (AsyncStorage.setItem) with the mode value', async () => {
    await act(async () => {
      await useThemeStore.getState().setMode('light');
    });

    // storage.set serialises non-string values as JSON, but 'light' is a string
    // so it should be stored as-is.
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_KEY, 'light');
  });

  // -----------------------------------------------------------------------
  // loadTheme
  // -----------------------------------------------------------------------

  it('loadTheme restores saved mode from storage', async () => {
    // Simulate AsyncStorage returning a previously saved mode
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('"dark"');

    await act(async () => {
      await useThemeStore.getState().loadTheme();
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('dark');
    expect(state.colorScheme).toBe('dark');
  });

  it('loadTheme falls back to "system" when storage is empty', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');

    await act(async () => {
      await useThemeStore.getState().loadTheme();
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
    expect(state.colorScheme).toBe('dark');
  });

  it('loadTheme resolves system colorScheme via Appearance when mode is "system"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('"system"');
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');

    await act(async () => {
      await useThemeStore.getState().loadTheme();
    });

    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
    expect(state.colorScheme).toBe('dark');
  });

  // -----------------------------------------------------------------------
  // Appearance change listener
  // -----------------------------------------------------------------------

  it('registers an Appearance change listener on module load', () => {
    // The store module calls Appearance.addChangeListener at the top level.
    expect(mockAddChangeListener).toHaveBeenCalled();
  });

  it('Appearance listener updates colorScheme when mode is "system"', () => {
    // Ensure mode is 'system'
    useThemeStore.setState({ mode: 'system', colorScheme: 'light' });

    // Grab the listener callback that was passed to addChangeListener
    const listenerCallback = mockAddChangeListener.mock.calls[0][0];

    // Simulate a system theme change
    act(() => {
      listenerCallback({ colorScheme: 'dark' });
    });

    expect(useThemeStore.getState().colorScheme).toBe('dark');
  });

  it('Appearance listener does NOT update colorScheme when mode is "light"', () => {
    useThemeStore.setState({ mode: 'light', colorScheme: 'light' });

    const listenerCallback = mockAddChangeListener.mock.calls[0][0];

    act(() => {
      listenerCallback({ colorScheme: 'dark' });
    });

    // colorScheme should remain 'light' because the user explicitly chose light mode
    expect(useThemeStore.getState().colorScheme).toBe('light');
  });

  it('Appearance listener does NOT update colorScheme when mode is "dark"', () => {
    useThemeStore.setState({ mode: 'dark', colorScheme: 'dark' });

    const listenerCallback = mockAddChangeListener.mock.calls[0][0];

    act(() => {
      listenerCallback({ colorScheme: 'light' });
    });

    expect(useThemeStore.getState().colorScheme).toBe('dark');
  });
});
