import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.login' });

  return { title: t('title'), description: t('welcomeDesc') };
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
