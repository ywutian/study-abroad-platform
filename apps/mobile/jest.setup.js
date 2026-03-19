// Mock the theme store globally
jest.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    colorScheme: 'light',
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  }),
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  Link: ({ children }) => children,
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

// Mock react-native-worklets (native module not available in Jest)
jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(),
  runOnRuntime: jest.fn(),
  runOnJS: jest.fn((fn) => fn),
  runOnUI: jest.fn((fn) => fn),
  makeShareableCloneRecursive: jest.fn((v) => v),
}));

// Mock react-native-reanimated (Worklets runtime not available in Jest)
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { call: jest.fn() },
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: (fn) => fn(),
  useReducedMotion: () => false,
  withTiming: (v) => v,
  withSpring: (v) => v,
  withDelay: (_, v) => v,
  withSequence: (...args) => args[args.length - 1],
  withRepeat: (v) => v,
  Easing: { linear: jest.fn(), ease: jest.fn(), bezier: jest.fn(() => jest.fn()) },
  FadeIn: { duration: jest.fn().mockReturnThis() },
  FadeOut: { duration: jest.fn().mockReturnThis() },
  SlideInRight: { duration: jest.fn().mockReturnThis() },
  SlideOutLeft: { duration: jest.fn().mockReturnThis() },
  Layout: { duration: jest.fn().mockReturnThis() },
  cancelAnimation: jest.fn(),
  createAnimatedComponent: (component) => component,
  interpolate: jest.fn(),
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend' },
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Silence React Native logs in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
