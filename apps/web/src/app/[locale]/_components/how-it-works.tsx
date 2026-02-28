'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, Brain, Rocket } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

const steps = [
  { icon: UserPlus, key: 'step1', num: '01', color: 'from-violet-500 to-purple-600' },
  { icon: Brain, key: 'step2', num: '02', color: 'from-blue-500 to-cyan-500' },
  { icon: Rocket, key: 'step3', num: '03', color: 'from-emerald-500 to-teal-500' },
] as const;

export function HowItWorks() {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="section-normal">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-8 sm:mb-12">
          <h2 className="text-display-section">{t('home.howItWorks.title')}</h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            {t('home.howItWorks.subtitle')}
          </p>
        </div>

        <StaggerContainer staggerDelay={0.15}>
          <div className="mx-auto max-w-5xl grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
            {steps.map((step, index) => (
              <StaggerItem key={step.key} variant="fade">
                <div className="relative text-center">
                  {/* Connector line — dashed, visible md+ only, not on last item */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-7 left-[calc(50%+1.75rem)] right-[calc(-1.5rem)] h-px border-t border-dashed border-border/50" />
                  )}

                  {/* Number circle with hover scale */}
                  <motion.div
                    whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className={cn(
                      'mx-auto w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm md:text-base shadow-lg mb-4 cursor-default',
                      step.color
                    )}
                  >
                    {step.num}
                  </motion.div>

                  {/* Icon */}
                  <div className="mx-auto w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                    <step.icon className="h-5 w-5 text-foreground" />
                  </div>

                  {/* Text */}
                  <h3 className="text-lg font-semibold mb-2">
                    {t(`home.howItWorks.${step.key}Title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    {t(`home.howItWorks.${step.key}Desc`)}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </div>
        </StaggerContainer>
      </div>
    </section>
  );
}
