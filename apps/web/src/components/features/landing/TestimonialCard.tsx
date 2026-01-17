'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

interface TestimonialCardProps {
  name: string;
  avatar: string;
  background: string;
  school: string;
  program: string;
  result: string;
  quote: string;
  gradient: string;
  index?: number;
  className?: string;
}

export function TestimonialCard({
  name,
  avatar,
  background,
  school,
  program,
  result,
  quote,
  gradient,
  index = 0,
  className,
}: TestimonialCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ ...transitions.springGentle, delay: 0.1 + index * 0.1 }}
      className={cn('group', className)}
    >
      <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        <div className={cn('h-1.5 bg-gradient-to-r', gradient)} />
        <CardContent className="pt-5 pb-5 sm:pt-6 sm:pb-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br shadow-md',
                  gradient
                )}
              >
                {avatar}
              </div>
              <div>
                <p className="font-semibold">{name}</p>
                <p className="text-xs text-muted-foreground">{background}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-primary text-sm sm:text-base">{school}</p>
              <p className="text-xs text-muted-foreground">{program}</p>
            </div>
          </div>

          {/* Result Badge */}
          <div className="mb-4">
            <Badge
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-gradient-to-r',
                gradient
              )}
            >
              <CheckCircle className="h-3 w-3" />
              {result}
            </Badge>
          </div>

          {/* Quote */}
          <div className="relative">
            <Quote className="absolute -top-1 -left-1 h-6 w-6 text-muted-foreground/20" />
            <blockquote className="text-sm text-muted-foreground italic pl-5 border-l-2 border-primary/30">
              &ldquo;{quote}&rdquo;
            </blockquote>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
