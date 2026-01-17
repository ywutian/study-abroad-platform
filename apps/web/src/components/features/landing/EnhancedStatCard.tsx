'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

type ColorVariant = 'primary' | 'success' | 'warning' | 'info';

interface EnhancedStatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  color?: ColorVariant;
  index?: number;
  className?: string;
}

const colorMap: Record<
  ColorVariant,
  { gradient: string; iconBg: string; iconColor: string; valueColor: string }
> = {
  primary: {
    gradient: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    valueColor: 'text-blue-600 dark:text-blue-400',
  },
  success: {
    gradient: 'from-emerald-500 to-emerald-600',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    valueColor: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    gradient: 'from-amber-500 to-amber-600',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    valueColor: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    gradient: 'from-violet-500 to-violet-600',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
    valueColor: 'text-violet-600 dark:text-violet-400',
  },
};

export function EnhancedStatCard({
  icon: Icon,
  value,
  label,
  color = 'primary',
  index = 0,
  className,
}: EnhancedStatCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const colors = colorMap[color];

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ ...transitions.springGentle, delay: index * 0.1 }}
      className={className}
    >
      <Card className="overflow-hidden text-center hover:shadow-lg transition-shadow duration-300">
        <div className={cn('h-1 bg-gradient-to-r', colors.gradient)} />
        <CardContent className="pt-4 pb-4 sm:pt-6 sm:pb-6">
          <div
            className={cn(
              'flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl mx-auto mb-2 sm:mb-3',
              colors.iconBg
            )}
          >
            <Icon className={cn('h-5 w-5 sm:h-6 sm:w-6', colors.iconColor)} />
          </div>
          <div className={cn('text-2xl sm:text-3xl font-bold', colors.valueColor)}>{value}</div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
