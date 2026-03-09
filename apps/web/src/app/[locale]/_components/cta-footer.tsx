'use client';

import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { LandingFooter } from '@/components/features/landing';
import { FadeInView } from '@/components/ui/motion';
import { Magnetic } from '@/components/ui/tilt-card';

export function CTAFooter() {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();

  const footerSections = [
    {
      title: t('home.footer.products'),
      links: [
        { label: t('home.modules.schools.title'), href: '/schools' },
        { label: t('home.modules.uncommonApp.title'), href: '/uncommon-app' },
        { label: t('home.modules.featureHall.title'), href: '/hall' },
        { label: t('home.modules.forum.title'), href: '/forum' },
      ],
    },
    {
      title: t('home.footer.resources'),
      links: [
        { label: t('home.footer.helpCenter'), href: '/help' },
        { label: t('home.privacy'), href: '/privacy' },
        { label: t('home.terms'), href: '/terms' },
        { label: t('home.aboutUs'), href: '/about' },
      ],
    },
    {
      title: t('home.footer.contact'),
      links: [
        { label: t('home.footer.contactEmail'), href: `mailto:${t('home.footer.contactEmail')}` },
      ],
    },
  ];

  return (
    <div>
      {/* CTA Section — centered, zone-tinted */}
      <section id="cta" className="zone-tinted section-expansive relative overflow-hidden">
        {/* Background decoration */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 40%, oklch(0.58 0.22 255 / 0.06), transparent 70%)',
          }}
        />
        <div className="container relative mx-auto px-4">
          <FadeInView direction="up" className="mx-auto max-w-2xl text-center">
            {/* Badge */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs sm:text-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-primary">{t('home.ctaBadge')}</span>
            </div>

            <h2 className="text-display-section text-gradient-animated">{t('home.ctaTitle')}</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-muted-foreground">
              {t('home.ctaSubtitle')}
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <Magnetic intensity={0.3}>
                <Link href="/register">
                  <motion.div
                    whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                  >
                    <Button
                      size="lg"
                      className="w-full sm:w-auto h-12 px-8 sm:px-8 lg:h-14 lg:px-10 text-sm sm:text-base lg:text-lg font-semibold btn-gradient-primary btn-glow rounded-xl"
                    >
                      {t('home.ctaButton')}
                      <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </motion.div>
                </Link>
              </Magnetic>
              <Magnetic intensity={0.2}>
                <Link href="/cases">
                  <motion.div
                    whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                  >
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto h-12 px-8 sm:px-8 lg:h-14 lg:px-10 text-sm sm:text-base"
                    >
                      {t('home.viewCases')}
                    </Button>
                  </motion.div>
                </Link>
              </Magnetic>
            </div>

            {/* Feature checkmarks */}
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {['ctaFeature1', 'ctaFeature2', 'ctaFeature3'].map((key) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"
                >
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{t(`home.${key}`)}</span>
                </div>
              ))}
            </div>
          </FadeInView>
        </div>
      </section>

      {/* Footer */}
      <LandingFooter
        description={t('home.footer.description')}
        sections={footerSections}
        copyright={t('home.copyright')}
      />
    </div>
  );
}
