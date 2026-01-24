module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    // In a pnpm monorepo packages live at:
    //   node_modules/.pnpm/<pkg>@ver/node_modules/<pkg>/...
    // There are TWO node_modules/ segments in every path.  The regex engine
    // will try to match at each one, so we must list .pnpm as well as every
    // RN/Expo family package (using [^/]* suffixes to cover variants like
    // expo-modules-core, react-native-gesture-handler, etc.).
    'node_modules/(?!(\\.pnpm|@?react-native[^/]*|@?expo[^/]*|@react-navigation[^/]*|@react-native-community[^/]*|react-navigation[^/]*|@unimodules|unimodules|native-base|@tanstack[^/]*|@sentry[^/]*|i18next|react-i18next|zustand|socket\\.io[^/]*|engine\\.io[^/]*|@study-abroad[^/]*)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@stores/(.*)$': '<rootDir>/src/stores/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
  },
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
