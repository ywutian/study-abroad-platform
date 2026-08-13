import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Newsreader, Inter } from 'next/font/google';
import {
  CRITICAL_COLOR_PALETTE_IDS,
  getThemeCssText,
  getWebThemeBootstrapScript,
} from '@study-abroad/shared';
import { THEME_CSS_HREF } from '@/lib/theme-css';

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
import { locales } from '@/lib/i18n/config';
import { stripAdminNamespaces } from '@/lib/i18n/message-scope';
import { Providers } from '@/components/providers';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo';
// 2026-05 Phase 4 follow-up: Web Vitals → Sentry reporter.
import { WebVitalsReporter } from '@/components/observability/web-vitals-reporter';
import { env } from '@/lib/env';
import { buildAlternates } from '@/lib/seo';
import '../globals.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.home' });
  const common = await getTranslations({ locale, namespace: 'common' });
  // x-pathname is forwarded by proxy.ts; the fallback only fires if the
  // middleware is bypassed, in which case the locale root is the right guess.
  const alternates = buildAlternates((await headers()).get('x-pathname') ?? `/${locale}`);

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
    alternates,
    title: {
      default: t('title'),
      template: `%s | ${common('appName')}`,
    },
    description: t('description'),
    keywords: t('keywords').split(','),
    authors: [{ name: common('appName') }],
    openGraph: {
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      siteName: common('appName'),
      url: alternates.canonical as string,
    },
    twitter: {
      card: 'summary_large_image',
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  const messages = await getMessages();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${newsreader.variable} ${inter.variable}`}
    >
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: getWebThemeBootstrapScript() }}
        />
        {/* Link first so the parser finds it before the inline block. Both sit
            after Next's own CSS chunks, which is what lets `--ds-*` beat the
            legacy `:root` rules in the bundled sheet. */}
        <link rel="stylesheet" href={THEME_CSS_HREF} />
        <style
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: getThemeCssText(CRITICAL_COLOR_PALETTE_IDS) }}
        />
        {/* Rendered in dev too: gating this on NODE_ENV was the only reason
            structured data was invisible locally, which is how it went
            unnoticed that JsonLd emitted nothing server-side at all. */}
        <OrganizationJsonLd
          name="Lumni"
          url={env.NEXT_PUBLIC_APP_URL}
          description="AI-driven study abroad planning platform" /* @i18n-skip SEO metadata */
        />
        <WebSiteJsonLd
          name="Lumni"
          url={env.NEXT_PUBLIC_APP_URL}
          potentialAction={{
            type: 'SearchAction',
            target: `${env.NEXT_PUBLIC_APP_URL}/schools?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* admin 那一块只发给 /admin/*（见 lib/i18n/message-scope.ts + admin/layout.tsx） */}
        <NextIntlClientProvider messages={stripAdminNamespaces(messages)}>
          {/* Mount Web Vitals reporter once at the locale root — fires
              globally for every navigation. Renders null. */}
          <WebVitalsReporter />
          <Providers nonce={nonce}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
