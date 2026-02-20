import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import withPWA from '@ducanh2912/next-pwa';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@study-abroad/shared', 'geist'],
  // output: 'standalone', // 仅用于 Docker/VPS 部署，Vercel 不需要
  experimental: {
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
  // 安全头 — 与 API 端 Helmet 配置保持一致
  async headers() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || '';
    const apiUrlNorm = apiUrl.replace(/\/$/, '');
    const apiWsNorm = apiUrl
      ? apiUrl.replace(/^https?:/, (m) => (m === 'https:' ? 'wss:' : 'ws:')).replace(/\/$/, '')
      : '';
    const wsUrlNorm = wsUrl.replace(/\/$/, '');
    const extra: string[] = [];
    if (apiUrlNorm) {
      extra.push(apiUrlNorm);
      if (apiWsNorm) extra.push(apiWsNorm);
    }
    if (wsUrlNorm && wsUrlNorm !== apiWsNorm) {
      extra.push(wsUrlNorm);
      const wsHttps = wsUrlNorm.replace(/^wss?:/, (m) => (m === 'wss:' ? 'https:' : 'http:'));
      if (wsHttps !== apiUrlNorm) extra.push(wsHttps);
    }
    const connectSrcParts = ["'self'", 'https://*.sentry.io', 'wss:', ...extra];
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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              `connect-src ${connectSrcParts.join(' ')}`,
              "font-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  // 代理 API 请求到后端，避免跨域 cookie 问题
  async rewrites() {
    const fallback =
      process.env.NODE_ENV === 'production'
        ? 'https://study-abroad-api-1032896108391.us-central1.run.app'
        : 'http://localhost:3001';
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
