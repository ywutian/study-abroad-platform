'use client';

import { useTranslations } from 'next-intl';

export interface HomeNavContent {
  product: string;
  cases: string;
  pricing: string;
  community: string;
  about: string;
  signIn: string;
  getStarted: string;
}

export interface HomeHeroContent {
  eyebrow: string;
  headline: [string, string];
  subtitle: string;
  features: string[];
  trustLine: string;
  primaryCta: string;
  secondaryCta: string;
  statLabel: string;
  floatingQuote: {
    quote: string;
    meta: string;
  };
  aiDisclosure: {
    trigger: string;
    inputs: string[];
    confidence: 'high' | 'medium' | 'low';
    limitations: string[];
  };
}

export interface HomeStat {
  value: string;
  label: string;
}

export interface HomeContentItem {
  number: string;
  tag?: string;
  title: string;
  description: string;
}

export interface HomeSocialQuote {
  quote: string;
  name: string;
  meta: string;
  tag: string;
  monogram: string;
}

export interface HomeFooterColumn {
  title: string;
  links: string[];
}

export interface HomeSectionCollection {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export interface HomeContent {
  brand: string;
  nav: HomeNavContent;
  hero: HomeHeroContent;
  trust: { label: string; stats: HomeStat[]; schools: string[] };
  problem: HomeSectionCollection & { items: HomeContentItem[] };
  features: HomeSectionCollection & { items: HomeContentItem[] };
  how: HomeSectionCollection & { steps: HomeContentItem[] };
  social: HomeSectionCollection & { stats: HomeStat[]; quotes: HomeSocialQuote[] };
  cta: {
    eyebrow: string;
    title: [string, string];
    subtitle: string;
    primary: string;
    secondary: string;
    trust: string;
  };
  footer: {
    description: string;
    columns: HomeFooterColumn[];
    copyright: string;
    note: string;
  };
}

function normalizeDisclosureConfidence(value: string): 'high' | 'medium' | 'low' {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'high') {
    return 'high';
  }

  if (normalized === 'low') {
    return 'low';
  }

  return 'medium';
}

export function useHomeContent(): HomeContent {
  const t = useTranslations('home');
  const confidenceLevel = useTranslations('ui.aiDisclosure.confidenceLevels');
  const hero = t.raw('hero') as Omit<HomeHeroContent, 'aiDisclosure'> & {
    aiDisclosure: Omit<HomeHeroContent['aiDisclosure'], 'confidence'> & { confidence: string };
  };
  const localizedHigh = confidenceLevel('high').trim().toLowerCase();
  const localizedLow = confidenceLevel('low').trim().toLowerCase();

  return {
    brand: t('brand'),
    nav: t.raw('nav') as HomeNavContent,
    hero: {
      ...hero,
      aiDisclosure: {
        ...hero.aiDisclosure,
        confidence: normalizeDisclosureConfidence(
          hero.aiDisclosure.confidence
            .replace(new RegExp(`^${localizedHigh}$`, 'i'), 'high')
            .replace(new RegExp(`^${localizedLow}$`, 'i'), 'low')
        ),
      },
    },
    trust: t.raw('trust') as HomeContent['trust'],
    problem: t.raw('problem') as HomeSectionCollection & { items: HomeContentItem[] },
    features: t.raw('features') as HomeSectionCollection & { items: HomeContentItem[] },
    how: t.raw('how') as HomeSectionCollection & { steps: HomeContentItem[] },
    social: t.raw('social') as HomeSectionCollection & {
      stats: HomeStat[];
      quotes: HomeSocialQuote[];
    },
    cta: t.raw('cta') as HomeContent['cta'],
    footer: t.raw('footer') as HomeContent['footer'],
  };
}
