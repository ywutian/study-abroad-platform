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
    '^@study-abroad/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@study-abroad/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  // Floor set just below ACTUAL coverage (stmts 25.7 / br 23.4 / fn 21.1 / ln 26.3
  // as of closure #2 follow-up) — the old 3-5% floor was meaningless (it was the
  // threshold, never the real coverage; 29 suites / 321 tests already cover ~1/4).
  // ~1-2pt buffer absorbs run variance. Ratcheted via
  // scripts/coverage-thresholds.baseline.json — raise as coverage grows, never lower.
  coverageThreshold: {
    global: {
      branches: 29,
      functions: 25,
      lines: 31,
      statements: 30,
    },
  },
};
