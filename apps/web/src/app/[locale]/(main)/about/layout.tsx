import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

interface AboutLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AboutLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about.metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default function AboutLayout({ children }: AboutLayoutProps) {
  return children;
}
