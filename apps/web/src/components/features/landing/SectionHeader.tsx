'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

interface SectionHeaderProps {
  badge?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  size?: 'default' | 'display';
  className?: string;
}

export function SectionHeader({
  badge,
  title,
  subtitle,
  align = 'center',
  size = 'default',
  className,
}: SectionHeaderProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        'mb-8 sm:mb-12',
        align === 'center' ? 'mx-auto max-w-2xl text-center' : 'text-left',
        className
      )}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={transitions.springGentle}
    >
      {badge && (
        <Badge variant="secondary" className="mb-3">
          {badge}
        </Badge>
      )}
      <h2 className={size === 'display' ? 'text-display-section' : 'text-title-lg'}>{title}</h2>
      {subtitle && (
        <p
          className={cn(
            'mt-3 text-muted-foreground',
            size === 'display' ? 'text-base sm:text-lg' : 'text-body-sm'
          )}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
