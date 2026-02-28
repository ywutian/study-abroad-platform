'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Calendar, HelpCircle } from 'lucide-react';
import { StaggerContainer, StaggerItem } from '@/components/ui/motion';

const pains = [
  { icon: AlertTriangle, key: 'pain1', color: 'text-red-500', bg: 'bg-red-500/10' },
  { icon: Calendar, key: 'pain2', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { icon: HelpCircle, key: 'pain3', color: 'text-blue-500', bg: 'bg-blue-500/10' },
] as const;

export function ProblemStatement() {
  const t = useTranslations();

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  }, []);

  return (
    <section className="section-normal">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-8 sm:mb-12">
          <h2 className="text-display-section">{t('home.problem.title')}</h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            {t('home.problem.subtitle')}
          </p>
        </div>

        <StaggerContainer staggerDelay={0.12}>
          <div className="mx-auto max-w-5xl grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {pains.map((pain) => (
              <StaggerItem key={pain.key} variant="fade">
                <div
                  className="group relative rounded-2xl border bg-card p-5 md:p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden"
                  onMouseMove={handleMouseMove}
                >
                  {/* Cursor glow — hover devices only */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background:
                        'radial-gradient(300px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), oklch(0.58 0.22 255 / 0.06), transparent 60%)',
                    }}
                  />
                  <div className="relative z-10">
                    <div className={`rounded-xl ${pain.bg} p-3 w-fit mb-4`}>
                      <pain.icon className={`h-6 w-6 ${pain.color}`} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {t(`home.problem.${pain.key}Title`)}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(`home.problem.${pain.key}Desc`)}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </div>
        </StaggerContainer>
      </div>
    </section>
  );
}
