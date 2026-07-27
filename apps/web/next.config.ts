import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
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
    // /public 原图带的是 `max-age=0, must-revalidate`，图片优化器会继承它，
    // 于是每个回访者都要为 LCP 图付一趟 304 往返（生产实测 114ms，占 LCP 的 12%）。
    //
    // 30 天而不是 1 年：`/_next/image?url=…&w=…&q=…` 不含源图的内容哈希，
    // 所以原地替换 /public 下的同名图片是拿不到缓存失效的。30 天已经吃掉了
    // 几乎全部收益（回访者零重验证），又把「换了图但没换文件名」的最坏情况
    // 兜在一个月内。要延长到 1 年的前提是先约定图片改名带版本号。
    minimumCacheTTL: 2592000,
    qualities: [75, 90],
    remotePatterns: [
      { protocol: 'https', hostname: 'www.google.com', pathname: '/s2/favicons**' },
      { protocol: 'https', hostname: 'img.logo.dev', pathname: '/**' },
      { protocol: 'https', hostname: 'upload.wikimedia.org', pathname: '/**' },
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
      {
        // 这才是让 /_next/image 产物对浏览器可缓存的那一步，`images.minimumCacheTTL`
        // 不够：Vercel 不用 Next 自带的图片优化器，它自己那套里 minimumCacheTTL 只管
        // **边缘缓存**的 TTL，发给浏览器的 Cache-Control 是从**上游源图**派生的。
        //
        // 生产实测（#522 上线后）：取一个从未缓存过的尺寸 w=828，x-vercel-cache: MISS
        // 且 age: 0——是当前部署现生成的——拿到的仍是 max-age=0，因为 /public 下的原图
        // 就是 max-age=0。所以要改的是源头。
        //
        // 30 天而不是 1 年：/_next/image 的 URL 不含源图内容哈希，原地替换同名图片
        // 拿不到缓存失效。落地页的图会换（#494 换过一轮）。
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }],
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

// PWA: deliberately REMOVED (2026-06, sw-pinning incident).
// next-pwa was a webpack-hook plugin; `next build` runs Turbopack, so no sw.js
// was generated in production builds anyway — the PWA was already dead. The
// only service workers in the wild are stale pinned ones from the Jan–Mar 2026
// window (installed when builds were webpack and the proxy matcher didn't
// intercept /sw.js). public/sw.js is now a STATIC, tracked self-destroying
// kill-switch: pinned browsers fetch it on their SW update check, it installs,
// unregisters itself, wipes caches, and reloads its clients. Do NOT re-add a
// precaching service worker without reading the incident notes in
// src/proxy.ts (matcher comment) and src/proxy.matcher.test.ts.

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

// 组合配置：Intl -> BundleAnalyzer -> Sentry
const configWithIntl = withNextIntl(nextConfig);
const configWithAnalyzer = analyzeBundles(configWithIntl);

export default process.env.SENTRY_DSN
  ? withSentryConfig(configWithAnalyzer, sentryConfig)
  : configWithAnalyzer;
