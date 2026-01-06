import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import withPWA from '@ducanh2912/next-pwa';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@study-abroad/shared'],
  // output: 'standalone', // 仅用于 Docker/VPS 部署，Vercel 不需要
};

// PWA 配置
const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  workboxOptions: {
    skipWaiting: true,
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-images',
          expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /^https:\/\/api\..*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
    ],
  },
});

const sentryConfig = {
  // Suppress source map upload logs during build
  silent: true,

  // Organization and project for Sentry
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps to Sentry
  widenClientFileUpload: true,

  // Routes that should be tunneled through Sentry
  tunnelRoute: '/monitoring',

  // Disable injection of Sentry's SDK in edge runtime
  disableLogger: true,

  // Automatically annotate React components
  reactComponentAnnotation: {
    enabled: true,
  },
};

// 组合配置：Intl -> PWA -> Sentry
const configWithIntl = withNextIntl(nextConfig);
const configWithPWA = pwaConfig(configWithIntl);

export default process.env.SENTRY_DSN
  ? withSentryConfig(configWithPWA, sentryConfig)
  : configWithPWA;
