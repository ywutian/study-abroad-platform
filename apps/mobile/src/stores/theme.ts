import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import { DEFAULT_COLOR_PALETTE, parseColorPalette, type ColorPalette } from '@study-abroad/shared';
import { storage } from '@/lib/storage/secure-store';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  colorScheme: ColorSchemeName;
  colorPalette: ColorPalette;

  setMode: (mode: ThemeMode) => Promise<void>;
  setColorPalette: (palette: ColorPalette) => Promise<void>;
  loadTheme: () => Promise<void>;
}

const THEME_KEY = 'app_theme';
const COLOR_PALETTE_KEY = 'app_color_palette';

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  colorScheme: Appearance.getColorScheme(),
  colorPalette: DEFAULT_COLOR_PALETTE,

  setMode: async (mode: ThemeMode) => {
    await storage.set(THEME_KEY, mode);

    const colorScheme = mode === 'system' ? Appearance.getColorScheme() : mode;

    set({ mode, colorScheme });
  },

  setColorPalette: async (palette: ColorPalette) => {
    const nextPalette = parseColorPalette(palette);
    await storage.set(COLOR_PALETTE_KEY, nextPalette);

    set({ colorPalette: nextPalette });
  },

  loadTheme: async () => {
    const [savedMode, savedPalette] = await Promise.all([
      storage.get<ThemeMode>(THEME_KEY),
      storage.get<string>(COLOR_PALETTE_KEY),
    ]);
    const mode = savedMode || 'system';
    const colorScheme = mode === 'system' ? Appearance.getColorScheme() : mode;
    const colorPalette = parseColorPalette(savedPalette);

    set({ mode, colorScheme, colorPalette });
  },
}));

// Listen to system theme changes
Appearance.addChangeListener(({ colorScheme }) => {
  const { mode } = useThemeStore.getState();
  if (mode === 'system') {
    useThemeStore.setState({ colorScheme });
  }
});
