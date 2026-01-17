'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

interface CTASectionProps {
  badge?: string;
  title: string;
  subtitle: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  features?: string[];
  className?: string;
}

export function CTASection({
  badge,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  features,
  className,
}: CTASectionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className={cn('relative py-12 sm:py-16 lg:py-20 overflow-hidden', className)}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5" />
      <div className="absolute inset-0 bg-grid opacity-30" />

      {/* Decorative blurs */}
      <div className="absolute -left-20 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -right-20 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="container relative mx-auto px-4">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={transitions.springGentle}
        >
          {/* Badge */}
          {badge && (
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <Sparkles className="h-3 w-3" />
              {badge}
            </Badge>
          )}

          {/* Title */}
          <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl mb-4">{title}</h2>

          {/* Subtitle */}
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg mb-6 sm:mb-8">
            {subtitle}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-6">
            <Link href={primaryAction.href}>
              <motion.div
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
              >
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold"
                >
                  {primaryAction.label}
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </motion.div>
            </Link>
            {secondaryAction && (
              <Link href={secondaryAction.href}>
                <motion.div
                  whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base"
                  >
                    {secondaryAction.label}
                  </Button>
                </motion.div>
              </Link>
            )}
          </div>

          {/* Features */}
          {features && features.length > 0 && (
            <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
