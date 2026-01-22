module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    // Handle pnpm node_modules structure (.pnpm)
    'node_modules/(?!(.pnpm|@react-native|react-native|expo|@expo|react-navigation|@react-navigation|@unimodules|unimodules|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|react-native-markdown-display|@tanstack|i18next|react-i18next|zustand)/)',
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
