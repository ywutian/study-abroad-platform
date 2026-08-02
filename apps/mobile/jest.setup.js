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

// Mock expo/fetch (WinterCG fetch with native streaming) → delegate to global fetch
jest.mock('expo/fetch', () => ({
  fetch: (...args) => global.fetch(...args),
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
// Prefix with `mock` so jest.mock() factory can reference it.
function mockChainableAnimation() {
  const anim = {};
  const methods = [
    'duration',
    'delay',
    'springify',
    'damping',
    'stiffness',
    'mass',
    'withInitialValues',
    'withCallback',
    'build',
  ];
  methods.forEach((m) => {
    anim[m] = jest.fn().mockReturnValue(anim);
  });
  return anim;
}

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    call: jest.fn(),
    createAnimatedComponent: (component) => component,
    addWhitelistedNativeProps: jest.fn(),
    addWhitelistedUIProps: jest.fn(),
    View: 'Animated.View',
  },
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: (fn) => fn(),
  useAnimatedRef: () => ({ current: null }),
  useEvent: jest.fn(),
  useHandler: jest.fn(),
  useReducedMotion: () => false,
  useAnimatedGestureHandler: jest.fn(),
  useAnimatedScrollHandler: jest.fn(),
  withTiming: (v) => v,
  withSpring: (v) => v,
  withDelay: (_, v) => v,
  withSequence: (...args) => args[args.length - 1],
  withRepeat: (v) => v,
  Easing: {
    linear: jest.fn(),
    ease: jest.fn(),
    bezier: jest.fn(() => jest.fn()),
    in: jest.fn(() => jest.fn()),
    out: jest.fn(() => jest.fn()),
    inOut: jest.fn(() => jest.fn()),
    cubic: jest.fn(),
    quad: jest.fn(),
    circle: jest.fn(),
    exp: jest.fn(),
    back: jest.fn(),
    bounce: jest.fn(),
    elastic: jest.fn(),
    sin: jest.fn(),
    poly: jest.fn(() => jest.fn()),
  },
  FadeIn: mockChainableAnimation(),
  FadeOut: mockChainableAnimation(),
  FadeInDown: mockChainableAnimation(),
  FadeInUp: mockChainableAnimation(),
  FadeInRight: mockChainableAnimation(),
  FadeInLeft: mockChainableAnimation(),
  SlideInUp: mockChainableAnimation(),
  SlideInDown: mockChainableAnimation(),
  SlideInRight: mockChainableAnimation(),
  SlideInLeft: mockChainableAnimation(),
  SlideOutLeft: mockChainableAnimation(),
  SlideOutRight: mockChainableAnimation(),
  Layout: mockChainableAnimation(),
  cancelAnimation: jest.fn(),
  createAnimatedComponent: (component) => component,
  interpolate: jest.fn(),
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend' },
}));

// Mock react-native-gesture-handler
// Returns a Proxy-based chainable gesture so any method call returns itself.
function mockChainableGesture() {
  const handler = {
    get(target, prop) {
      if (typeof prop === 'symbol') return undefined;
      return (..._args) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }) => children,
    Gesture: {
      Pan: () => mockChainableGesture(),
      Tap: () => mockChainableGesture(),
      LongPress: () => mockChainableGesture(),
      Pinch: () => mockChainableGesture(),
      Rotation: () => mockChainableGesture(),
      Fling: () => mockChainableGesture(),
      Native: () => mockChainableGesture(),
      Manual: () => mockChainableGesture(),
      Hover: () => mockChainableGesture(),
      Simultaneous: (...args) => mockChainableGesture(),
      Exclusive: (...args) => mockChainableGesture(),
      Race: (...args) => mockChainableGesture(),
    },
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: require('react-native').ScrollView,
    FlatList: require('react-native').FlatList,
    PanGestureHandler: View,
    TapGestureHandler: View,
    TouchableOpacity: require('react-native').TouchableOpacity,
    TouchableHighlight: require('react-native').TouchableHighlight,
    TouchableWithoutFeedback: require('react-native').TouchableWithoutFeedback,
    Directions: {},
  };
});

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// React Query intentionally schedules long cache-GC timers. In Jest those
// timers should preserve their behavior without keeping the Node process alive.
const { timeoutManager } = require('@tanstack/react-query');
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => {
    const timer = setTimeout(callback, delay);
    timer.unref?.();
    return timer;
  },
  clearTimeout: (timer) => clearTimeout(timer),
  setInterval: (callback, delay) => {
    const timer = setInterval(callback, delay);
    timer.unref?.();
    return timer;
  },
  clearInterval: (timer) => clearInterval(timer),
});

// Silence React Native logs in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
