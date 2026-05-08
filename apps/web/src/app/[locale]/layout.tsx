import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Newsreader, Inter } from 'next/font/google';

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
import {
  COLOR_PALETTES,
  COLOR_PALETTE_STORAGE_KEY,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_HERO_VISUAL_ID,
  HERO_VISUAL_IDS,
  HERO_VISUAL_STORAGE_KEY,
  getThemeCssText,
} from '@study-abroad/shared';
import { locales } from '@/lib/i18n/config';
import { Providers } from '@/components/providers';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo';
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

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${newsreader.variable} ${inter.variable}`}
    >
      <head>
        <style nonce={nonce} dangerouslySetInnerHTML={{ __html: getThemeCssText() }} />
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
        {/* Inline bootstrap (not next/script): avoids React 19 “script in component tree” warnings
            and matches early theme class application before first paint. */}
        <script
          id="theme-class-init"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=document.documentElement;if(t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('dark')}else{d.classList.remove('dark')}}catch(e){}})()`,
          }}
        />
        <script
          id="color-palette-init"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(COLOR_PALETTE_STORAGE_KEY)};var p=localStorage.getItem(k);var d=document.documentElement;var a=${JSON.stringify(COLOR_PALETTES)};var m={warm:${JSON.stringify(DEFAULT_COLOR_PALETTE)},slate:"linear-indigo"};var n=m[p]||p;if(a.indexOf(n)>-1){d.setAttribute('data-color-palette',n)}else{d.setAttribute('data-color-palette',${JSON.stringify(DEFAULT_COLOR_PALETTE)})}}catch(e){}})()`,
          }}
        />
        <script
          id="hero-visual-init"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(HERO_VISUAL_STORAGE_KEY)};var v=localStorage.getItem(k);var d=document.documentElement;var a=${JSON.stringify(HERO_VISUAL_IDS)};if(a.indexOf(v)>-1){d.setAttribute('data-hero-visual',v)}else{d.setAttribute('data-hero-visual',${JSON.stringify(DEFAULT_HERO_VISUAL_ID)})}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
