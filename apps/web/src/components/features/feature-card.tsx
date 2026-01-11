'use client';

/**
 * 特性卡片组件 - 带 3D 悬浮效果
 */

import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
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
  gradient?: string;
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  className,
  index = 0,
  gradient,
}: FeatureCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Motion values for 3D tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring physics
  const springConfig = { stiffness: 300, damping: 30 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), springConfig);

  // Glare position
  const glareX = useTransform(x, [-0.5, 0.5], ['20%', '80%']);
  const glareY = useTransform(y, [-0.5, 0.5], ['20%', '80%']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const normalizedX = (e.clientX - centerX) / rect.width;
    const normalizedY = (e.clientY - centerY) / rect.height;

    x.set(normalizedX);
    y.set(normalizedY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        ...transitions.springGentle,
        delay: index * 0.1,
      },
    },
  };

  if (prefersReducedMotion) {
    return (
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow',
          className
        )}
      >
        <CardContent Icon={Icon} title={title} description={description} gradient={gradient} />
      </div>
    );
  }

  return (
    <motion.div
      ref={cardRef}
      className={cn('relative', className)}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      style={{ perspective: 1000 }}
    >
      <motion.div
        className="group relative overflow-hidden rounded-xl border bg-card p-6 shadow-sm"
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={{ scale: 1.02, y: -4 }}
        transition={transitions.spring}
      >
        {/* Glare Effect */}
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.15) 0%, transparent 50%)`,
          }}
        />

        {/* Gradient Border on Hover */}
        <motion.div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, transparent 50%, rgba(99,102,241,0.1) 100%)',
          }}
        />

        {/* Content */}
        <div style={{ transform: 'translateZ(20px)' }}>
          <CardContent Icon={Icon} title={title} description={description} gradient={gradient} />
        </div>

        {/* Bottom Glow */}
        <motion.div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 rounded-full blur-xl opacity-0 group-hover:opacity-50 transition-opacity"
          style={{ background: gradient || 'rgba(99,102,241,0.5)' }}
        />
      </motion.div>
    </motion.div>
  );
}

function CardContent({
  Icon,
  title,
  description,
  gradient,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  gradient?: string;
}) {
  return (
    <>
      {/* 背景装饰 */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-primary/10 to-transparent transition-all duration-500 group-hover:scale-150 group-hover:from-primary/20" />

      {/* 图标 */}
      <motion.div
        className="relative mb-4 inline-flex rounded-xl bg-primary/10 p-3 text-primary"
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={transitions.springSnappy}
      >
        <Icon className="h-6 w-6" />

        {/* Icon glow */}
        <motion.div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100"
          style={{
            background: gradient || 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(99,102,241,0.1))',
            filter: 'blur(8px)',
          }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>

      {/* 内容 */}
      <div className="relative">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold transition-colors group-hover:text-primary">
            {title}
          </h3>
          <motion.div
            className="opacity-0 group-hover:opacity-100"
            initial={{ x: -8, opacity: 0 }}
            whileHover={{ x: 0, opacity: 1 }}
          >
            <ArrowUpRight className="h-4 w-4 text-primary" />
          </motion.div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </>
  );
}

// ============================================
// 统计卡片
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
      className="rounded-xl border border-stat-card bg-stat-card p-4 text-center backdrop-blur"
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...transitions.springGentle, delay: 0.3 + index * 0.1 }}
      whileHover={prefersReducedMotion ? {} : { scale: 1.05, y: -2 }}
    >
      {Icon && (
        <div className="mb-2 flex justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      )}
      <motion.div
        className="text-2xl font-bold text-stat-card sm:text-3xl"
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 + index * 0.1 }}
      >
        {value}
      </motion.div>
      <div className="mt-1 text-sm text-stat-card-muted">{label}</div>
    </motion.div>
  );
}

// ============================================
// CTA 卡片
// ============================================

interface CTACardProps {
  title: string;
  description: string;
  action: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  variant?: 'default' | 'gradient';
}

export function CTACard({ title, description, action, variant = 'default' }: CTACardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-2xl p-8 text-center',
        variant === 'gradient'
          ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground'
          : 'border bg-card'
      )}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={transitions.springGentle}
    >
      {/* Background decoration */}
      {variant === 'gradient' && (
        <>
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        </>
      )}

      <div className="relative z-10">
        <h2 className="mb-3 text-2xl font-bold">{title}</h2>
        <p className={cn('mb-6 max-w-md mx-auto', variant === 'gradient' ? 'text-white/80' : 'text-muted-foreground')}>
          {description}
        </p>
        <motion.button
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors',
            variant === 'gradient'
              ? 'bg-white text-primary hover:bg-white/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
          onClick={action.onClick}
          whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
        >
          {action.label}
          <ArrowUpRight className="h-4 w-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}
