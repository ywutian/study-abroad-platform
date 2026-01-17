'use client';

/**
 * 特性卡片组件 - 学术严肃风
 * 去除 3D 效果和发光，使用简洁边框和过渡
 */

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowUpRight } from 'lucide-react';
import { transitions } from '@/lib/motion';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  className?: string;
  index?: number;
  gradient?: string; // 保留但不使用渐变
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  className,
  index = 0,
}: FeatureCardProps) {
  const prefersReducedMotion = useReducedMotion();

  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        ...transitions.springGentle,
        delay: index * 0.08,
      },
    },
  };

  if (prefersReducedMotion) {
    return (
      <div
        className={cn(
          'group relative rounded-lg border-2 border-border bg-card p-6 transition-colors hover:border-primary/30',
          className
        )}
      >
        <CardContent Icon={Icon} title={title} description={description} />
      </div>
    );
  }

  return (
    <motion.div
      className={cn('relative', className)}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        className="group relative rounded-lg border-2 border-border bg-card p-6 transition-colors hover:border-primary/30"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
      >
        <CardContent Icon={Icon} title={title} description={description} />
      </motion.div>
    </motion.div>
  );
}

function CardContent({
  Icon,
  title,
  description,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <>
      {/* 学术风图标：方形边框容器 */}
      <div className="mb-4 inline-flex rounded-md border-2 border-primary/20 bg-primary/5 p-3 text-primary">
        <Icon className="h-6 w-6" />
      </div>

      {/* 内容 */}
      <div className="relative">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold transition-colors group-hover:text-primary">
            {title}
          </h3>
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4 text-primary" />
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </>
  );
}

// ============================================
// 统计卡片 - 学术严肃风
// ============================================

interface StatCardProps {
  value: string;
  label: string;
  index?: number;
  icon?: LucideIcon;
}

export function StatCard({ value, label, index = 0, icon: Icon }: StatCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="rounded-lg border-2 border-border bg-card p-4 text-center"
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.springGentle, delay: 0.2 + index * 0.08 }}
    >
      {Icon && (
        <div className="mb-2 flex justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      )}
      <div className="text-2xl font-bold text-foreground sm:text-3xl">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </motion.div>
  );
}

// ============================================
// CTA 卡片 - 学术严肃风
// ============================================

interface CTACardProps {
  title: string;
  description: string;
  action: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  variant?: 'default' | 'primary';
}

export function CTACard({ title, description, action, variant = 'default' }: CTACardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        'relative rounded-lg p-8 text-center border-2',
        variant === 'primary'
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card'
      )}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={transitions.springGentle}
    >
      <div className="relative z-10">
        <h2 className="mb-3 text-2xl font-bold">{title}</h2>
        <p
          className={cn(
            'mb-6 max-w-md mx-auto',
            variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'
          )}
        >
          {description}
        </p>
        <motion.button
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-6 py-3 font-medium border-2 transition-colors',
            variant === 'primary'
              ? 'bg-primary-foreground text-primary border-primary-foreground hover:bg-primary-foreground/90'
              : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
          )}
          onClick={action.onClick}
          whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
        >
          {action.label}
          <ArrowUpRight className="h-4 w-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}
