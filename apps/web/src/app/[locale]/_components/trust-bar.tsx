'use client';

import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { Building2, FileText, TrendingUp, Bot } from 'lucide-react';
import { AnimatedNumber, StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { SchoolMarquee } from './school-marquee';
import { cn } from '@/lib/utils';

const stats = [
  {
    icon: Building2,
    value: 3000,
    suffix: '+',
    labelKey: 'home.stats.schools',
    color: 'text-blue-500',
  },
  {
    icon: FileText,
    value: 10000,
    suffix: '+',
    labelKey: 'home.stats.cases',
    color: 'text-emerald-500',
  },
  {
    icon: TrendingUp,
    value: 95,
    suffix: '%',
    labelKey: 'home.stats.accuracy',
    color: 'text-amber-500',
  },
] as const;

export function TrustBar() {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="zone-tinted section-compact">
      <div className="container mx-auto px-4">
        {/* Stats row with staggered entrance */}
        <StaggerContainer staggerDelay={0.1}>
          <div className="grid grid-cols-2 gap-6 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-12 lg:gap-20">
            {stats.map((stat, index) => (
              <StaggerItem key={stat.labelKey} variant="fade">
                <div className="flex items-center gap-3">
                  <div className={cn('rounded-xl bg-primary/10 p-2.5 sm:p-3', stat.color)}>
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-0.5">
                      <AnimatedNumber
                        value={stat.value}
                        className={cn(
                          'text-2xl sm:text-3xl lg:text-4xl font-extrabold',
                          stat.color
                        )}
                        duration={1.5 + index * 0.3}
                      />
                      <span className={cn('text-xl sm:text-2xl font-extrabold', stat.color)}>
                        {stat.suffix}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t(stat.labelKey)}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}

            {/* 24/7 AI - static with pulse dot */}
            <StaggerItem variant="fade">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 sm:p-3 text-violet-500">
                  <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-violet-500">
                      24/7
                    </span>
                    <motion.div
                      className="h-2 w-2 rounded-full bg-emerald-500"
                      animate={
                        prefersReducedMotion ? {} : { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }
                      }
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t('home.stats.aiAssistant')}
                  </p>
                </div>
              </div>
            </StaggerItem>
          </div>
        </StaggerContainer>

        {/* School marquee */}
        <div className="mt-6 sm:mt-8 border-t border-border/50 pt-4 sm:pt-6">
          <SchoolMarquee />
        </div>
      </div>
    </section>
  );
}
