'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

interface FeaturePreviewCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
  href: string;
  index?: number;
  className?: string;
}

export function FeaturePreviewCard({
  icon: Icon,
  title,
  description,
  gradient,
  iconBg,
  iconColor,
  href,
  index = 0,
  className,
}: FeaturePreviewCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ ...transitions.springGentle, delay: index * 0.08 }}
      className={className}
    >
      <Link href={href}>
        <Card className="group h-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className={cn('h-1.5 bg-gradient-to-r', gradient)} />
          <CardContent className="pt-5 pb-5 sm:pt-6 sm:pb-6">
            {/* Icon */}
            <div
              className={cn(
                'mb-4 inline-flex rounded-xl p-3 transition-colors',
                iconBg,
                'group-hover:scale-105 transition-transform'
              )}
            >
              <Icon className={cn('h-6 w-6', iconColor)} />
            </div>

            {/* Content */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base sm:text-lg font-semibold transition-colors group-hover:text-primary">
                {title}
              </h3>
              <div className="opacity-0 transition-opacity group-hover:opacity-100">
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {description}
            </p>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
