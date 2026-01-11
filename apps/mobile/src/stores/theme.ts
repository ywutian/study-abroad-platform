import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import { storage } from '@/lib/storage/secure-store';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  colorScheme: ColorSchemeName;
  
  setMode: (mode: ThemeMode) => Promise<void>;
  loadTheme: () => Promise<void>;
}

const THEME_KEY = 'app_theme';

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  colorScheme: Appearance.getColorScheme(),

  setMode: async (mode: ThemeMode) => {
    await storage.set(THEME_KEY, mode);
    
    const colorScheme = mode === 'system' 
      ? Appearance.getColorScheme() 
      : mode;
    
    set({ mode, colorScheme });
  },

  loadTheme: async () => {
    const savedMode = await storage.get<ThemeMode>(THEME_KEY);
    const mode = savedMode || 'system';
    const colorScheme = mode === 'system' 
      ? Appearance.getColorScheme() 
      : mode;
    
    set({ mode, colorScheme });
  },
}));

// Listen to system theme changes
Appearance.addChangeListener(({ colorScheme }) => {
  const { mode } = useThemeStore.getState();
  if (mode === 'system') {
    useThemeStore.setState({ colorScheme });
  }
});









