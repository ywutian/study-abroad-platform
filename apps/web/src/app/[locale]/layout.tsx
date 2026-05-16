import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Newsreader, Inter } from 'next/font/google';
import { getThemeCssText, getWebThemeBootstrapScript } from '@study-abroad/shared';

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
import { Providers } from '@/components/providers';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo';
// 2026-05 Phase 4 follow-up: Web Vitals → Sentry reporter.
import { WebVitalsReporter } from '@/components/observability/web-vitals-reporter';
import { env } from '@/lib/env';
import '../globals.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.home' });
  const common = await getTranslations({ locale, namespace: 'common' });

  return {
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
  const shouldRenderStructuredData = process.env.NODE_ENV === 'production';

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${newsreader.variable} ${inter.variable}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: getWebThemeBootstrapScript() }} />
        <style nonce={nonce} dangerouslySetInnerHTML={{ __html: getThemeCssText() }} />
        {shouldRenderStructuredData ? (
          <>
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
          </>
        ) : null}
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          {/* Mount Web Vitals reporter once at the locale root — fires
              globally for every navigation. Renders null. */}
          <WebVitalsReporter />
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
