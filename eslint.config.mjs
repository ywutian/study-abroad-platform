import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.vercel/**',
      '**/prisma/migrations/**',
    ],
  },

  // Base recommended rules
  eslint.configs.recommended,

  // TypeScript recommended rules (without type-checking for speed)
  ...tseslint.configs.recommended,

  // React hooks plugin (needed for inline eslint-disable comments referencing react-hooks rules)
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.{tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },

  // Global settings for all TS/TSX files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      // Suppress "Definition for rule X was not found" from inline comments
      reportUnusedDisableDirectives: 'warn',
    },
    rules: {
      // ── Keep rules relaxed at root level ──
      // Sub-projects enforce stricter rules via `turbo lint`

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/ban-ts-comment': 'off',

      // Core JS
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-undef': 'off',
      'no-empty': 'warn',
      'no-unused-expressions': 'off',
      'no-useless-escape': 'warn',
      'no-misleading-character-class': 'warn',
      'no-case-declarations': 'warn',
      'prefer-const': 'warn',
    },
  },
);
