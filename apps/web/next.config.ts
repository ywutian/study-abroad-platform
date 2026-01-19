import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import withPWA from '@ducanh2912/next-pwa';

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
      'recharts',
      '@tanstack/react-query',
    ],
  },
  // 代理 API 请求到后端，避免跨域 cookie 问题
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006';
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

// 组合配置：Intl -> PWA -> Sentry
const configWithIntl = withNextIntl(nextConfig);
const configWithPWA = pwaConfig(configWithIntl);

export default process.env.SENTRY_DSN
  ? withSentryConfig(configWithPWA, sentryConfig)
  : configWithPWA;
