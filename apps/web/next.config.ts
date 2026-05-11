import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import withPWA from '@ducanh2912/next-pwa';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');
const appDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appDir, '../..');

const nextConfig: NextConfig = {
  transpilePackages: ['@study-abroad/shared', 'geist'],
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    qualities: [75, 90],
    remotePatterns: [
      { protocol: 'https', hostname: 'www.google.com', pathname: '/s2/favicons**' },
      { protocol: 'https', hostname: 'img.logo.dev', pathname: '/**' },
    ],
  },
  experimental: {
    viewTransition: true,
    // 优化大型包的 barrel exports，显著减少编译和打包时间
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-icons',
      '@sentry/nextjs',
      'date-fns',
      '@tanstack/react-query',
    ],
  },
  // Security headers (CSP is set dynamically in middleware.ts with per-request nonce)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  // 已删除/合并的路由重定向
  async redirects() {
    return [
      { source: '/:locale/find-college', destination: '/:locale/schools', permanent: true },
      {
        source: '/:locale/recommendation',
        destination: '/:locale/schools?tab=recommend',
        permanent: true,
      },
      { source: '/:locale/swipe', destination: '/:locale/hall', permanent: true },
      {
        source: '/:locale/verified-ranking',
        destination: '/:locale/hall?tab=verified',
        permanent: true,
      },
      // A1: Content + Reports → Moderation
      {
        source: '/:locale/admin/content',
        destination: '/:locale/admin/moderation',
        permanent: true,
      },
      {
        source: '/:locale/admin/reports',
        destination: '/:locale/admin/moderation?tab=reports',
        permanent: true,
      },
      // A2: Data Updates → Schools (sync tab)
      {
        source: '/:locale/admin/data-updates',
        destination: '/:locale/admin/schools?tab=sync',
        permanent: true,
      },
      // A5: Essay Gallery → Cases (essays tab)
      {
        source: '/:locale/essay-gallery',
        destination: '/:locale/cases?tab=essays',
        permanent: true,
      },
      {
        source: '/:locale/essay-gallery/:id',
        destination: '/:locale/cases/essays/:id',
        permanent: true,
      },
      // A6: AI Agent + Analytics + Health → AI Operations
      {
        source: '/:locale/admin/ai-agent',
        destination: '/:locale/admin/ai-operations',
        permanent: true,
      },
      {
        source: '/:locale/admin/analytics',
        destination: '/:locale/admin/ai-operations?tab=performance',
        permanent: true,
      },
      {
        source: '/:locale/admin/health',
        destination: '/:locale/admin/ai-operations',
        permanent: true,
      },
      // A3: Deadlines + Events → Calendar
      {
        source: '/:locale/admin/deadlines',
        destination: '/:locale/admin/calendar',
        permanent: true,
      },
      {
        source: '/:locale/admin/events',
        destination: '/:locale/admin/calendar?tab=events',
        permanent: true,
      },
    ];
  },
  // 代理 API 请求到后端，避免跨域 cookie 问题
  async rewrites() {
    const fallback =
      process.env.NODE_ENV === 'production'
        ? 'https://study-abroad-api-1032896108391.us-central1.run.app'
        : 'http://localhost:4101';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || fallback;
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
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

// Bundle 分析：ANALYZE=true pnpm --filter web build
const analyzeBundles = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

// 组合配置：Intl -> PWA -> BundleAnalyzer -> Sentry
const configWithIntl = withNextIntl(nextConfig);
const configWithPWA = pwaConfig(configWithIntl);
const configWithAnalyzer = analyzeBundles(configWithPWA);

export default process.env.SENTRY_DSN
  ? withSentryConfig(configWithAnalyzer, sentryConfig)
  : configWithAnalyzer;
