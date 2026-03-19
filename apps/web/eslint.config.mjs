import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    // Auto-generated service worker files (next-pwa / Workbox)
    "public/sw.js",
    "public/workbox-*.js",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      // rules-of-hooks must be error — violations cause runtime crashes
      "react-hooks/rules-of-hooks": "error",
      // React 19 Compiler diagnostics — optimization hints, not code quality issues
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // jsx-a11y plugin is already registered by eslint-config-next — just add rules
    files: ["**/*.tsx"],
    rules: {
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
    },
  },
]);

export default eslintConfig;
